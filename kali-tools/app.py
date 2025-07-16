from threading import Thread, Lock
import time
from venv import logger
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import subprocess
import re
import logging
import requests
from pathlib import Path
import json
import uuid
from queue import Queue, Empty
import os
import os
from werkzeug.utils import secure_filename

from subprocess import Popen, PIPE

active_processes = {}
process_lock = Lock()



app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})  # Hanya izinkan origin yang dipercaya
socketio = SocketIO(app, cors_allowed_origins="*")  # Enable SocketIO with CORS

# Configuration
UPLOAD_FOLDER = './uploads'
Path(UPLOAD_FOLDER).mkdir(exist_ok=True, mode=0o777)
ALLOWED_EXTENSIONS = {'txt'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024  # 1MB limit

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# 1. Environment Setup Function
def setup_go_environment():
    """Initialize Go environment by sourcing bashrc"""
    try:
        command = ['bash', '-c', 'source ~/.bashrc && env']
        proc = Popen(command, stdout=PIPE, stderr=PIPE)
        stdout, stderr = proc.communicate()
        
        if proc.returncode != 0:
            raise Exception(f"Failed to source bashrc: {stderr.decode()}")
        
        # Update environment variables
        for line in stdout.decode().splitlines():
            if '=' in line:
                key, val = line.split('=', 1)
                os.environ[key] = val
        
        # Ensure Go binaries are in PATH
        go_bin_path = os.path.expanduser('~/go/bin')
        if go_bin_path not in os.environ['PATH']:
            os.environ['PATH'] = f"{go_bin_path}:{os.environ['PATH']}"
        
        logger.info("Go environment setup successfully")
        return True
    except Exception as e:
        logger.error(f"Go environment setup failed: {str(e)}")
        return False

# 2. Run setup in background thread
setup_done = False

@app.route("/health")
def health():
    return "OK", 200

@app.before_request
def initialize():
    global setup_done
    if not setup_done:
        Thread(target=setup_go_environment).start()
        setup_done = True

def is_valid_domain(domain):
    """Validate domain format"""
    pattern = r'^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:[0-9]+)?$'
    return re.match(pattern, domain) is not None

def is_valid_url(url):
    """Validate URL format"""
    url_pattern = r'^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:[0-9]+)?(/\S*)?$'
    domain_pattern = r'^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:[0-9]+)?$'
    return re.match(url_pattern, url) or re.match(domain_pattern, url)

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS



@app.route('/api/scan', methods=['POST'])
def scan():
    data = request.json
    domain = data.get('domain')
    
    if not domain:
        return jsonify({"error": "Domain is required"}), 400
    if not is_valid_domain(domain):
        return jsonify({"error": "Invalid domain format"}), 400

    command = ["assetfinder", "--subs-only", domain]
    
    try:
        logging.debug(f"Executing command: {' '.join(command)}")
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        stdout = result.stdout.decode("utf-8")
        logging.debug(f"Command output: {stdout}")
        return jsonify({"output": stdout})
    except subprocess.CalledProcessError as e:
        stderr = e.stderr.decode("utf-8")
        logging.error(f"Command error: {stderr}")
        return jsonify({"error": stderr}), 500
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/scan/check-active', methods=['POST'])
def check_active_urls():
    try:
        # Handle file upload
        if 'file' in request.files:
            file = request.files['file']
            
            if file.filename == '':
                return jsonify({"error": "No selected file"}), 400
                
            if not allowed_file(file.filename):
                return jsonify({"error": "Only .txt files are allowed"}), 400
                
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            command = [
                "/usr/local/bin/httpx",
                "-l", filepath,
                "-threads", "200", 
                "-status-code", 
                "-follow-redirects",
                "-silent",
                "-json"
            ]
            
        # Handle single URL
        # Handle single domain
        elif 'domain' in request.form:  # Perhatikan perubahan dari 'url' ke 'domain'
            domain = request.form['domain']
            
            if not domain:
                return jsonify({"error": "Domain is required"}), 400
                
            if not is_valid_domain(domain):
                return jsonify({"error": "Invalid domain format"}), 400
                
            command = [
                "/usr/local/bin/httpx",
                "-u", f"http://{domain}",
                "-threads", "200", 
                "-status-code", 
                "-follow-redirects",
                "-json"
            ]
        else:
            return jsonify({"error": "Either provide a file or domain"}), 400
        
        # Execute command and capture output directly
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=300,
            text=True
        )
        
        logger.debug(f"Command executed: {' '.join(command)}")
        logger.debug(f"Return code: {result.returncode}")
        logger.debug(f"stdout: {result.stdout}")
        logger.debug(f"stderr: {result.stderr}")
        
        if result.returncode != 0:
            error_msg = result.stderr.strip() or "httpx command failed"
            logger.error(f"Command failed: {error_msg}")
            return jsonify({"error": error_msg}), 500
        
        # Parse JSON output from httpx
        if result.stdout:
            try:
                # Handle multiple JSON lines (when input is file)
                output_lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
                results = [json.loads(line) for line in output_lines]
                
                # Format response
                active_urls = []
                for item in results:
                    active_urls.append({
                        "url": item.get("url", ""),
                        "status_code": item.get("status_code", 0),
                        "final_url": item.get("final_url", "")
                    })
                
                # Cleanup uploaded file if exists
                if 'filepath' in locals() and os.path.exists(filepath):
                    os.remove(filepath)
                
                return jsonify({
                    "status": "success",
                    "results": active_urls,
                    "count": len(active_urls)
                })
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse httpx output: {str(e)}")
                return jsonify({"error": "Failed to parse scan results"}), 500
        else:
            return jsonify({"error": "No results returned from scan / wrong format"}), 404
            
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Scan timed out after 5 minutes"}), 504
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500




@app.route('/api/fuzz', methods=['POST'])
def url_fuzzer():
    """Endpoint for URL fuzzing with ffuf"""
    session_id = str(uuid.uuid4())
    # Check if both target and file are provided
    if 'file' not in request.files or 'target' not in request.form:
        return jsonify({"error": "Both target URL and wordlist file are required"}), 400
    
    file = request.files['file']
    target = request.form['target']
    
    # Validate file
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"error": "Only .txt files are allowed"}), 400
    
    # Validate target URL contains FUZZ
    if "FUZZ" not in target:
        return jsonify({"error": "Target URL must contain 'FUZZ' placeholder"}), 400
    
    # Secure filename and add UUID
    original_filename = secure_filename(file.filename)
    unique_filename = f"{uuid.uuid4()}_{original_filename}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
    file.save(filepath)
    
    # Validate target URL format
    if not is_valid_url(target.replace("FUZZ", "test")):
        os.remove(filepath)  # Clean up
        return jsonify({"error": "Invalid target URL format"}), 400
    
    # Prepare ffuf command (no FUZZ replacement needed now)
    command = [
        "/usr/local/bin/ffuf",
        "-u", target,
        "-w", filepath,
        "-of", "json"
    ]
    
    # Create a queue to capture output
    output_queue = Queue()
    
    def run_ffuf():
        try:
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            # Simpan proses dan filepath ke dictionary
            with process_lock:
                active_processes[session_id] = {
                    'process': process,
                    'filepath': filepath
                }
            
            # Read output line by line
            for line in process.stdout:
                with process_lock:
                    if session_id in active_processes:  # Cek jika proses belum dihentikan
                        output_queue.put(line)
                    else:
                        break  # Keluar jika proses diminta berhenti
            
            process.wait()
            output_queue.put(None)  # Signal completion
        except Exception as e:
            output_queue.put(f"Error: {str(e)}")
            output_queue.put(None)
        finally:
            # Hanya hapus dari active_processes, file akan dibersihkan oleh cleanup function
            with process_lock:
                if session_id in active_processes:
                    del active_processes[session_id]
    
    # Start ffuf in a separate thread
    Thread(target=run_ffuf).start()
    
    def generate():
        try:
            while True:
                try:
                    line = output_queue.get(timeout=1)
                    if line is None:
                        break
                    yield line
                except Empty:
                    continue
        finally:
            # Cleanup file setelah streaming selesai
            cleanup_resources_fuzz(session_id, filepath)
    
    return Response(generate(), mimetype='text/html'), 200, {'X-Session-ID': session_id}

def cleanup_resources_fuzz(session_id, filepath=None):
    """Bersihkan resource untuk session tertentu"""
    logger.debug(f"Cleaning up resources for session_id: {session_id}")
    
    with process_lock:
        # Ambil dan hapus data dari active_processes
        process_data = active_processes.pop(session_id, None)
    
    if process_data:
        if isinstance(process_data, dict):
            process = process_data.get('process')
            stored_filepath = process_data.get('filepath')
        else:
            # Untuk backward compatibility jika masih ada format lama
            process = process_data
            stored_filepath = None
            
        if process:
            logger.debug(f"Terminating process for session_id: {session_id}")
            try:
                process.terminate()
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                logger.debug(f"Forcing kill for session_id: {session_id}")
                process.kill()
            except Exception as e:
                logger.error(f"Error terminating process: {str(e)}")
        
        # Gunakan filepath yang disimpan atau yang diberikan sebagai parameter
        file_to_remove = filepath or stored_filepath
        if file_to_remove and os.path.exists(file_to_remove):
            logger.debug(f"Removing file: {file_to_remove}")
            try:
                os.remove(file_to_remove)
            except FileNotFoundError:
                pass
            except Exception as e:
                logger.error(f"Error removing file {file_to_remove}: {str(e)}")

@app.route('/api/fuzz/stop', methods=['POST'])
def stop_fuzzing():
    """Endpoint to stop running fuzzing process"""
    data = request.get_json()
    if not data or 'session_id' not in data:
        return jsonify({"error": "Session ID is required"}), 400

    session_id = data['session_id']
    
    with process_lock:
        if session_id not in active_processes:
            return jsonify({"error": "Session not found or already terminated"}), 404
        
        # Ambil filepath sebelum cleanup
        process_data = active_processes.get(session_id)
        filepath = None
        if isinstance(process_data, dict):
            filepath = process_data.get('filepath')
    
    try:
        cleanup_resources_fuzz(session_id, filepath)
        return jsonify({"message": "Fuzzing stopped successfully"}), 200
    except Exception as e:
        logger.error(f"Failed to stop fuzzing: {str(e)}")
        return jsonify({"error": f"Failed to stop fuzzing: {str(e)}"}), 500
    
    
@app.route('/api/crawlurl', methods=['POST'])
def crawl_url():
    try:
        # Handle file upload
        if 'file' in request.files:
            file = request.files['file']
            
            if file.filename == '':
                return jsonify({"error": "No selected file"}), 400
                
            if not allowed_file(file.filename):
                return jsonify({"error": "Only .txt files are allowed"}), 400
                
            # Simpan file
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            # Eksekusi paramspider langsung dengan file input
            command = ["paramspider", "-l", filepath, "-s"]
            output = execute_paramspider(command)
            results = parse_paramspider_output(output) if output else []
            
            # Cleanup file terlebih dahulu
            try:
                os.remove(filepath)
            except FileNotFoundError:
                pass
            
            # Tunggu sebentar sebelum cleanup results untuk memastikan proses selesai
            import time
            time.sleep(2)
            cleanup_results()
            
            return jsonify({
                "status": "success",
                "results": results,
                "count": len(results)
            })
            
        # Handle single domain
        elif request.json and 'domain' in request.json:
            domain = request.json['domain']
            
            if not is_valid_domain(domain):
                return jsonify({"error": "Invalid domain format"}), 400
                
            command = ["paramspider", "-d", domain, "-s"]
            output = execute_paramspider(command)
            results = parse_paramspider_output(output) if output else []
            
            # Tunggu sebentar sebelum cleanup results untuk memastikan proses selesai
            import time
            time.sleep(2)
            cleanup_results()
            
            return jsonify({
                "status": "success",
                "results": results,
                "count": len(results)
            })
            
        else:
            return jsonify({"error": "Either provide a file or single domain"}), 400
            
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        # Tunggu sebentar sebelum cleanup pada error handling
        import time
        time.sleep(1)
        cleanup_results()
        return jsonify({"error": str(e)}), 500

def execute_paramspider(command):
    """Execute paramspider and return live output"""
    try:
        logger.debug(f"Executing: {' '.join(command)}")
        
        # Pastikan directory results ada sebelum menjalankan paramspider
        results_dir = "results"
        if not os.path.exists(results_dir):
            os.makedirs(results_dir, exist_ok=True)
            logger.debug(f"Created results directory: {results_dir}")
        
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # Tunggu proses selesai dengan timeout
        output, error = process.communicate(timeout=300)
        
        if process.returncode != 0:
            logger.error(f"Paramspider error: {error.strip()}")
            return None
        
        # Tunggu sedikit untuk memastikan semua file operations selesai
        import time
        time.sleep(0.5)
        
        logger.debug("Paramspider execution completed successfully")
        return output
        
    except subprocess.TimeoutExpired:
        process.kill()
        logger.error("Paramspider execution timed out")
        return None
    except Exception as e:
        logger.error(f"Error executing paramspider: {str(e)}")
        return None

def parse_paramspider_output(output):
    """Parse paramspider terminal output to extract URLs"""
    urls = []
    for line in output.splitlines():
        if line.startswith('http'):
            clean_url = line.split()[0].strip()
            urls.append(clean_url)
    return list(set(urls))

def cleanup_results():
    """Clean up results directory with delay and retry mechanism"""
    try:
        results_dir = "results"
        if os.path.exists(results_dir):
            # Tunggu untuk memastikan semua proses file selesai
            import time
            time.sleep(1)
            
            # Implementasi retry mechanism untuk cleanup
            max_retries = 5
            for attempt in range(max_retries):
                try:
                    subprocess.run(["rm", "-rf", results_dir], check=True, timeout=10)
                    logger.debug("Cleaned up results directory successfully")
                    break
                except subprocess.CalledProcessError as e:
                    if attempt < max_retries - 1:
                        logger.warning(f"Cleanup attempt {attempt + 1} failed: {str(e)}, retrying in 0.5s...")
                        time.sleep(0.5)
                    else:
                        logger.error(f"Failed to cleanup results directory after {max_retries} attempts: {str(e)}")
                except subprocess.TimeoutExpired:
                    logger.warning(f"Cleanup timeout on attempt {attempt + 1}")
                    if attempt < max_retries - 1:
                        time.sleep(0.5)
                    else:
                        logger.error("Cleanup timed out after multiple attempts")
                except Exception as e:
                    logger.error(f"Unexpected error during cleanup attempt {attempt + 1}: {str(e)}")
                    break
    except Exception as e:
        logger.error(f"Error in cleanup_results function: {str(e)}")


@app.route('/api/waf', methods=['POST'])
def check_waf():
    data = request.json
    domain = data.get('domain')
    
    if not domain:
        return jsonify({"error": "Domain is required"}), 400
    if not is_valid_domain(domain):
        return jsonify({"error": "Invalid domain format"}), 400

    command = ["wafw00f", domain]
    
    try:
        logging.debug(f"Executing command: {' '.join(command)}")
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        stdout = result.stdout.decode("utf-8")
        logging.debug(f"Command output: {stdout}")
        return jsonify({"output": stdout})
    except subprocess.CalledProcessError as e:
        stderr = e.stderr.decode("utf-8")
        logging.error(f"Command error: {stderr}")
        return jsonify({"error": stderr}), 500
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
    
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/deepcrawl', methods=['POST'])
def deep_crawl():
    try:
        data = request.json
        if not data or 'target' not in data:
            return jsonify({"error": "Target is required"}), 400

        target = data['target']
        
        # Tambahkan http:// jika tidak ada
        if not target.startswith(('http://', 'https://')):
            target = f"https://{target}"

        # Validasi target URL/domain
        if not is_valid_url(target):
            return jsonify({"error": "Invalid URL/domain format"}), 400

        # Build Katana command
        command = [
            "/usr/local/bin/katana",
            "-u", target,
            "-d", "5",  # depth
            "-ps",      # passive sources
            "-pss", "waybackarchive,commoncrawl,alienvault",
            "-f", "qurl",  # output format
            "-jc",      # JavaScript crawling
            "-xhr",     # include XHR requests
            "-kf",      # keep following redirects
            "-fx",      # extract forms
            "-fx",
            "dn",# don't submit forms
            "-ef", "woff,css,png,svg,jpg,woff2,jpeg,gif,svg"  # extensions to exclude
        ]

        logger.debug(f"Executing: {' '.join(command)}")

        # Eksekusi Katana dan tangkap output langsung
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )

        output, error = process.communicate(timeout=900)  # timeout 15 menit

        if process.returncode != 0:
            logger.error(f"Katana error: {error.strip()}")
            return jsonify({"error": error.strip() or "Katana execution failed"}), 500

        # Parse output untuk mengambil URL
        urls = []
        for line in output.splitlines():
            if line.startswith('http'):
                clean_url = line.split()[0].strip()  # Ambil URL pertama sebelum spasi
                urls.append(clean_url)

        return jsonify({
            "status": "success",
            "results": list(set(urls)),  # Hapus duplikat
            "count": len(urls)
        })

    except subprocess.TimeoutExpired:
        process.kill()
        logger.error("Katana execution timed out")
        return jsonify({"error": "Scan timed out after 15 minutes"}), 504
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500
    
    


@app.route('/api/wayback', methods=['POST'])
def wayback_dork():
    try:
        data = request.json
        if not data or 'target' not in data:
            return jsonify({"error": "Target is required"}), 400

        target = data['target']
        
        # Validasi input (hanya domain tanpa protocol)
        if not is_valid_domain(target) or any(target.startswith(p) for p in ['http://', 'https://']):
            return jsonify({"error": "Invalid domain format (don't include http/https)"}), 400

        # URL API Wayback Machine
        wayback_url = f"https://web.archive.org/cdx/search/cdx?url=*.{target}&fl=original&collapse=urlkey"
        wayback_url += "&filter=!mimetype:warc/revisit|text/css|image/jpeg|image/jpg|image/png|image/svg.xml|image/gif|image/tiff|image/webp|image/bmp|image/vnd|image/x-icon|image/vnd.microsoft.icon|font/ttf|font/woff|font/woff2|font/x-woff2|font/x-woff|font/otf|audio/mpeg|audio/wav|audio/webm|audio/aac|audio/ogg|audio/wav|audio/webm|video/mp4|video/mpeg|video/webm|video/ogg|video/mp2t|video/webm|video/x-msvideo|video/x-flv|application/font-woff|application/font-woff2|application/x-font-woff|application/x-font-woff2|application/vnd.ms-fontobject|application/font-sfnt|application/vnd.android.package-archive|binary/octet-stream|application/octet-stream|application/pdf|application/x-font-ttf|application/x-font-otf|video/webm|video/3gpp|application/font-ttf|audio/mp3|audio/x-wav|image/pjpeg|audio/basic|application/font-otf"
        wayback_url += "&filter=!statuscode:404|301|302"

        def generate():
            try:
                # Buat request streaming ke Wayback Machine
                with requests.get(wayback_url, stream=True) as r:
                    r.raise_for_status()
                    
                    # Stream response line by line
                    for line in r.iter_lines():
                        if line:  # Filter out keep-alive new lines
                            decoded_line = line.decode('utf-8').strip()
                            if decoded_line:  # Pastikan line tidak kosong
                                yield f"{decoded_line}\n"
                                
            except requests.exceptions.RequestException as e:
                yield f"Error: {str(e)}\n"

        return Response(
            stream_with_context(generate()),
            mimetype='text/plain',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Content-Type-Options': 'nosniff'
            }
        )

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/whois', methods=['POST'])
def whois_lookup():
    try:
        data = request.json
        if not data or 'domain' not in data:
            return jsonify({"error": "Domain is required"}), 400

        domain = data['domain']
        
        # Validasi input domain
        if not is_valid_domain(domain):
            return jsonify({"error": "Invalid domain format"}), 400

        # Bersihkan domain dari protokol jika ada
        domain = domain.replace('http://', '').replace('https://', '').split('/')[0]

        # Eksekusi command whois
        command = ["whois", domain]
        logger.debug(f"Executing: {' '.join(command)}")
        
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=120  
        )

        if result.returncode != 0:
            error_msg = result.stderr.strip() or "No match for Target"
            logger.error(f"WHOIS error: {error_msg}")
            return jsonify({"error": error_msg}), 500

        # Format output whois
        whois_data = result.stdout.strip()
        
        # Filter output sampai keyword tertentu
        filter_keyword = "Last update of whois database"
        if filter_keyword in whois_data:
            # Potong output sampai keyword (termasuk keyword)
            end_index = whois_data.find(filter_keyword) + len(filter_keyword)
            whois_data = whois_data[:end_index]
        
        return jsonify({
            "status": "success",
            "domain": domain,
            "whois": whois_data
        })

    except subprocess.TimeoutExpired:
        logger.error("WHOIS lookup timed out")
        return jsonify({"error": "WHOIS lookup timed out after 30 seconds"}), 504
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/nmap', methods=['POST'])
def nmap_scan():
    try:
        data = request.json
        if not data or 'target' not in data:
            return jsonify({"error": "Target is required"}), 400

        target = data['target']
        scan_type = data.get('scan_type', '1')  # Default scan type 1
        
        # Validasi target (domain atau IP)
        if not (is_valid_domain(target) or is_valid_ip(target)):
            return jsonify({"error": "Invalid target format"}), 400

        # Bangun command berdasarkan scan_type
        commands = {
            '1': ['nmap', '-sV', target],  # Deteksi Versi
            '2': ['nmap', '-p', '80,443,8080,8443,8000,8888', target],  # Port Web Umum
            '3': ['nmap', '-sV', '-p', '80,443', target],  # Deteksi Layanan Web
            '4': ['nmap', '-A', '-p', '80,443', target],  # Aggressive Scan
            '5': ['nmap', '--script', 'ssl-cert,ssl-enum-ciphers', '-p', '443', target]  # Cek TLS/SSL
        }

        if scan_type not in commands:
            return jsonify({"error": "Invalid scan type"}), 400

        command = commands[scan_type]
        logger.debug(f"Executing: {' '.join(command)}")

        # Eksekusi command
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=600  # Timeout 10 menit
        )

        if result.returncode != 0:
            error_msg = result.stderr.strip() or "Nmap command failed"
            logger.error(f"Nmap error: {error_msg}")
            return jsonify({"error": error_msg}), 500

        # Parse output nmap
        output = result.stdout.strip()
        return jsonify({
            "status": "success",
            "scan_type": scan_type,
            "results": output,
            "command": ' '.join(command)
        })

    except subprocess.TimeoutExpired:
        logger.error("Nmap execution timed out")
        return jsonify({"error": "Scan timed out after 10 minutes"}), 504
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500
    

@app.route('/api/cors-scan', methods=['POST'])
def cors_scan():
    try:
        data = request.json
        if not data or 'url' not in data:
            return jsonify({"error": "URL is required"}), 400

        url = data['url']
        
        # Validasi input URL
        if not url.startswith(('http://', 'https://')) or not is_valid_domain(url.split('//')[1].split('/')[0]):
            return jsonify({"error": "Invalid URL format"}), 400

        # Path ke direktori Corsy
        corsy_path = os.path.expanduser('~/tools/Corsy')
        if not os.path.exists(corsy_path):
            return jsonify({"error": "Corsy tool not found at ~/tools/Corsy"}), 500

        # Command untuk menjalankan Corsy
        command = ["python3", "corsy.py", "-u", url]
        
        # Jalankan command di direktori Corsy
        logging.debug(f"Executing command: {' '.join(command)}")
        result = subprocess.run(
            command,
            cwd=corsy_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=300  # Timeout 5 menit
        )

        if result.returncode != 0:
            error_msg = result.stderr.strip() or "Corsy execution failed"
            logger.error(f"Corsy error: {error_msg}")
            return jsonify({"error": error_msg}), 500

        # Parse output Corsy
        output = result.stdout.strip()
        vulnerabilities = parse_corsy_output(output)

        return jsonify({
            "status": "success",
            "target": url,
            "results": vulnerabilities,
            "raw_output": output  # Sertakan raw output untuk referensi
        })

    except subprocess.TimeoutExpired:
        logger.error("Corsy scan timed out")
        return jsonify({"error": "Scan timed out after 5 minutes"}), 504
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

def parse_corsy_output(output):
    """Parse Corsy tool output into structured data"""
    vulnerabilities = []
    current_vuln = {}
    
    for line in output.splitlines():
        line = line.strip()
        if line.startswith('+ http'):
            if current_vuln:  # Simpan vulnerability sebelumnya jika ada
                vulnerabilities.append(current_vuln)
                current_vuln = {}
            current_vuln['url'] = line[2:].strip()
        elif line.startswith('- '):
            parts = line[2:].split(':', 1)
            if len(parts) == 2:
                key = parts[0].strip().lower().replace(' ', '_')
                value = parts[1].strip()
                current_vuln[key] = value
    
    if current_vuln:  # Tambahkan vulnerability terakhir
        vulnerabilities.append(current_vuln)
    
    return vulnerabilities

@app.route('/api/openredirect', methods=['POST'])
def openredirect_scan():
    try:
        data = request.json
        if not data or 'url' not in data:
            return jsonify({"error": "URL is required"}), 400

        target_url = data['url']
        
        # Validasi URL
        if not (target_url.startswith(('http://', 'https://')) and is_valid_domain(target_url.split('//')[1].split('/')[0])):
            return jsonify({"error": "Invalid URL format"}), 400

        # Path ke tool Oralyzer
        oralyzer_path = os.path.expanduser("~/tools/Oralyzer/oralyzer.py")
        payloads_path = os.path.expanduser("~/tools/Oralyzer/payloads.txt")

        # Verifikasi file tool ada
        if not os.path.exists(oralyzer_path):
            return jsonify({"error": "Oralyzer tool not found at ~/tools/Oralyzer/"}), 500
        if not os.path.exists(payloads_path):
            return jsonify({"error": "Payloads file not found at ~/tools/Oralyzer/payloads.txt"}), 500

        # Bangun command
        command = ["python3", oralyzer_path, "-u", target_url, "-p", payloads_path]

        # Tambahkan log debug sebelum menjalankan command
        logger.debug(f"Executing: python3 {oralyzer_path} -u {target_url} -p {payloads_path}")

        def generate():
            try:
                process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1,
                    universal_newlines=True
                )

                # Flag untuk mendeteksi hasil
                found_vulnerabilities = False

                # Stream output langsung ke client
                for line in process.stdout:
                    # Deteksi hasil positif (apapun yang mengandung [+])
                    if "[+]" in line:
                        found_vulnerabilities = True
                        yield f"VULNERABLE: {line}"
                    elif "[-]" in line:
                        yield f"SAFE: {line}"
                    else:
                        yield f"INFO: {line}"

                # Jika tidak ada hasil positif
                if not found_vulnerabilities:
                    yield "INFO: No open redirect vulnerabilities found\n"

                # Tunggu proses selesai
                process.wait()

            except Exception as e:
                yield f"ERROR: {str(e)}\n"

        return Response(
            stream_with_context(generate()),
            mimetype='text/plain',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        )

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/xss-scan', methods=['POST'])
def xss_scan():
    """Endpoint for XSS scanning with Dalfox"""
    # Generate unique session ID
    session_id = str(uuid.uuid4())
    
    # Validate input
    if 'mode' not in request.form:
        return jsonify({"error": "Scan mode is required"}), 400
    
    mode = request.form['mode']
    payload_file = None
    target_file = None
    custom_payload_file = None
    
    # Handle file uploads
    if 'target_file' in request.files:
        target_file = request.files['target_file']
    if 'custom_payload' in request.files:
        custom_payload_file = request.files['custom_payload']
    
    # Prepare command based on mode
    command = ["dalfox"]
    
    try:
        # Mode 1-3: Single URL
        if mode in ['1', '2', '3']:
            if 'target_url' not in request.form:
                return jsonify({"error": "Target URL is required for this mode"}), 400
                
            target_url = request.form['target_url']
            if not is_valid_url(target_url):
                return jsonify({"error": "Invalid target URL format"}), 400
                
            command.extend(["url", target_url])
            
            # Add cookie header if provided
            if request.form.get('cookie'):
                cookie_value = request.form['cookie']
                command.extend(["-H", f"Cookie: {cookie_value}"])
            
            if mode == '1':  # Default payload
                command.extend(["-b", "https://hahwul.xss.ht"])
            elif mode == '2':  # Portswigger payload
                command.extend(["--remote-payloads", "portswigger"])
            elif mode == '3':  # Custom payload
                if not custom_payload_file:
                    return jsonify({"error": "Custom payload file is required for this mode"}), 400
                custom_payload_path = save_uploaded_file(custom_payload_file)
                command.extend(["--custom-payload", custom_payload_path, "--only-custom-payload"])
        
        # Mode 4-6: File input
        elif mode in ['4', '5', '6']:
            if not target_file:
                return jsonify({"error": "Target file is required for this mode"}), 400
                
            target_path = save_uploaded_file(target_file)
            command.extend(["file", target_path])
            
            # Add cookie header if provided
            if request.form.get('cookie'):
                cookie_value = request.form['cookie']
                command.extend(["-H", f"Cookie: {cookie_value}"])
            
            if mode == '4':  # Default payload
                command.extend(["-b", "https://hahwul.xss.ht"])
            elif mode == '5':  # Portswigger payload
                command.extend(["--remote-payloads", "portswigger"])
            elif mode == '6':  # Custom payload
                if not custom_payload_file:
                    return jsonify({"error": "Custom payload file is required for this mode"}), 400
                custom_payload_path = save_uploaded_file(custom_payload_file)
                command.extend(["--custom-payload", custom_payload_path, "--only-custom-payload"])
        
        else:
            return jsonify({"error": "Invalid scan mode"}), 400
        
         # Tambahkan logger.debug sebelum menjalankan Dalfox
        logger.debug(f"Executing Dalfox command: {' '.join(command)}")
        
        # Create output queue
        output_queue = Queue()
        
        def run_dalfox():
            try:
                process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1,
                    universal_newlines=True
                )
                
                active_processes[session_id] = process
                
                # Stream output line by line
                for line in process.stdout:
                    if session_id in active_processes:
                        # Skip banner and show only important output
                        if not line.startswith((' ', '  ', '\n', '🌙', '    _', '  .', ' :', " '-", '   -')) \
                           and 'Worker' not in line \
                           and 'Started at' not in line:
                            output_queue.put(line)
                    else:
                        break
                
                process.wait()
                output_queue.put(None)
            except Exception as e:
                output_queue.put(f"[ERROR] {str(e)}")
                output_queue.put(None)
            finally:
                cleanup_resources(session_id)
        
        # Start scanning in background thread
        Thread(target=run_dalfox).start()
        
        def generate():
            try:
                while True:
                    try:
                        line = output_queue.get(timeout=1)
                        if line is None:
                            break
                        yield line
                    except Empty:
                        continue
            finally:
                cleanup_resources(session_id)
        
        return Response(generate(), mimetype='text/plain'), 200, {'X-Session-ID': session_id}
    
    except Exception as e:
        cleanup_resources(session_id)
        return jsonify({"error": str(e)}), 500

def save_uploaded_file(file):
    """Save uploaded file with UUID prefix"""
    filename = f"{uuid.uuid4()}_{secure_filename(file.filename)}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    return filepath

def cleanup_resources(session_id):
    logger.debug(f"Cleaning up resources for session_id: {session_id}")
    process = active_processes.pop(session_id, None)
    if process:
        logger.debug(f"Removed process for session_id: {session_id}")
    
@app.route('/api/xss-scan/stop', methods=['POST'])
def stop_xss_scan():
    data = request.get_json()
    if not data or 'session_id' not in data:
        return jsonify({"error": "Session ID is required"}), 400
    
    session_id = data['session_id']
    if session_id not in active_processes:
        return jsonify({"error": "Session not found or already terminated"}), 404
    
    process = active_processes[session_id]
    try:
        process.terminate()
        cleanup_resources(session_id)
        return jsonify({"message": "Scan stopped successfully"}), 200
    except Exception as e:
        cleanup_resources(session_id)
        return jsonify({"error": f"Failed to stop scan: {str(e)}"}), 500


@app.route('/api/sqlscan', methods=['POST'])
def sqlmap_scan():
    """Endpoint for SQL injection scanning with SQLMap"""
    session_id = str(uuid.uuid4())
    
    try:
        data = request.json if request.is_json else request.form.to_dict()
        files = request.files
        
        # Validate minimum required parameters
        if not data.get('target'):
            return jsonify({"error": "Target is required"}), 400

        # Prepare base command
        command = ["sqlmap"]
        
        # Target options
        if data['target_type'] == 'url':
            command.extend(["-u", data['target']])
        elif data['target_type'] == 'logfile':
            if 'logfile' not in files:
                return jsonify({"error": "Log file is required for this target type"}), 400
            logfile_path = save_uploaded_file(files['logfile'])
            command.extend(["-l", logfile_path])
        
        # Request options
        if data.get('data'):
            command.extend(["--data", data['data']])
        if data.get('cookie'):
            command.extend(["--cookie", data['cookie']])
        if data.get('random_agent') == 'true':
            command.append("--random-agent")
        if data.get('proxy'):
            command.extend(["--proxy", data['proxy']])
        if data.get('tor') == 'true':
            command.append("--tor")
        
        # Injection parameters
        if data.get('test_parameter'):
            command.extend(["-p", data['test_parameter']])
        if data.get('dbms'):
            command.extend(["--dbms", data['dbms']])
        if data.get('tamper'):
            command.extend(["--tamper", data['tamper']])
        
         # Hanya tambahkan level/risk jika disertakan dalam request
        if data.get('level'):
            command.extend(["--level", data['level']])
        if data.get('risk'):
            command.extend(["--risk", data['risk']])
        if data.get('technique'):
            command.extend(["--technique", data['technique']])
        
        # Enumeration options
        enum_actions = {
            'banner': '-b',
            'current_user': '--current-user',
            'current_db': '--current-db',
            'hostname': '--hostname',
            'is_dba': '--is-dba',
            'users': '--users',
            'passwords': '--passwords',
            'privileges': '--privileges',
            'roles': '--roles',
            'dbs': '--dbs',
            'tables': '--tables',
            'columns': '--columns',
            'schema': '--schema',
            'dump': '--dump',
            'dump_all': '--dump-all',
            'search': '--search',
            'comments': '--comments',
            'statements': '--statements'
        }
        if data.get('dbs') == True:
            command.append("--dbs")
        
        for param, flag in enum_actions.items():
            if data.get(param) == 'true':
                command.append(flag)
        
        # Specific enumeration targets
        if data.get('db'):
            command.extend(["-D", data['db']])
        if data.get('table'):
            command.extend(["-T", data['table']])
        if data.get('column'):
            command.extend(["-C", data['column']])
        
        # OS access
        if data.get('os_shell') == 'true':
            command.append("--os-shell")
        if data.get('os_pwn') == 'true':
            command.append("--os-pwn")
        
        # General options
        command.append("--batch")
        if data.get('flush_session') == 'true':
            command.append("--flush-session")
        
        # Log the complete command
        logger.debug(f"SQLMap command to execute: {' '.join(command)}")
        
        # Create output queue
        output_queue = Queue()
        
        def run_sqlmap():
            try:
                logging.debug(f"Executing command: {' '.join(command)}")
                process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1,
                    universal_newlines=True
                )
                
                active_processes[session_id] = process
                logger.info(f"Started SQLMap scan with PID: {process.pid}")
                
                for line in process.stdout:
                    if session_id in active_processes:
                        # Kirim semua output tanpa filter
                        output_queue.put(line)
                    else:
                        logger.info("Process termination requested by user")
                        break
                
                process.wait()
                output_queue.put(None)
            except Exception as e:
                logger.error(f"SQLMap error: {str(e)}")
                output_queue.put(f"[ERROR] {str(e)}")
                output_queue.put(None)
            finally:
                cleanup_resources(session_id)
                logger.info(f"Cleaned up resources for session {session_id}")
        # Start scanning in background thread
        Thread(target=run_sqlmap).start()
        
        def generate():
            try:
                while True:
                    try:
                        line = output_queue.get(timeout=1)
                        if line is None:
                            break
                        yield line
                    except Empty:
                        continue
            finally:
                cleanup_resources(session_id)
        
        return Response(generate(), mimetype='text/plain'), 200, {
            'X-Session-ID': session_id,
            'X-Command': ' '.join(command)
        }
    
    except Exception as e:
        logger.error(f"API error: {str(e)}")
        cleanup_resources(session_id)
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/sqlscan/stop', methods=['POST'])
def stop_sqlmap_scan():
    """Stop running SQLMap scan"""
    data = request.json
    if not data or 'session_id' not in data:
        return jsonify({"error": "session_id is required"}), 400

    session_id = data['session_id']

    if session_id in active_processes:
        process = active_processes[session_id]
        try:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
            # Gunakan pop agar tidak error jika key sudah hilang
            active_processes.pop(session_id, None)
            return jsonify({"status": "stopped"})
        except Exception as e:
            # Pastikan tetap pop untuk cleanup
            active_processes.pop(session_id, None)
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "Scan not found or already stopped"}), 404


@app.route('/api/dnsrecon', methods=['POST'])
def dnsrecon_scan():
    """Endpoint for DNS enumeration with DNSRecon"""
    session_id = str(uuid.uuid4())
    
    try:
        
        data = request.json if request.is_json else request.form.to_dict()
        
        # Validate input
        if not data.get('domain'):
            return jsonify({"error": "Domain is required"}), 400
        
        domain = data['domain']
        if not is_valid_domain(domain):
            return jsonify({"error": "Invalid domain format"}), 400

        # Prepare base command
        command = ["dnsrecon", "-d", domain]
        
        # Add optional parameters
        if data.get('type'):
            command.extend(["-t", data['type']])  # e.g. axfr, brt, srv, etc.
        if data.get('name_server'):
            command.extend(["-n", data['name_server']])
        if data.get('threads'):
            command.extend(["--threads", str(data['threads'])])
        if data.get('csv'):
            command.extend(["--csv", data['csv']])
        
        logger.debug(f"Executing DNSRecon command: {' '.join(command)}")
        
        # Create output queue
        output_queue = Queue()
        
        def run_dnsrecon():
            try:
                logging.debug(f"Executing command: {' '.join(command)}")
                process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1,
                    universal_newlines=True
                )
                
                active_processes[session_id] = process
                logger.info(f"Started DNSRecon scan for {domain} (PID: {process.pid})")
                
                # Stream output line by line
                for line in process.stdout:
                    if session_id in active_processes:
                        # Filter and format output
                        if line.strip() and not line.startswith(('┌──', '└──')):
                            output_queue.put(line)
                    else:
                        break
                
                process.wait()
                output_queue.put(None)
            except Exception as e:
                logger.error(f"DNSRecon error: {str(e)}")
                output_queue.put(f"[ERROR] {str(e)}")
                output_queue.put(None)
            finally:
                if session_id in active_processes:
                    del active_processes[session_id]
                logger.info(f"Completed DNSRecon scan for {domain}")
        
        # Start scan in background thread
        Thread(target=run_dnsrecon).start()
        
        def generate():
            try:
                while True:
                    try:
                        line = output_queue.get(timeout=1)
                        if line is None:
                            break
                        yield line
                    except Empty:
                        continue
            finally:
                if session_id in active_processes:
                    del active_processes[session_id]
        
        return Response(generate(), mimetype='text/plain'), 200, {
            'X-Session-ID': session_id,
            'X-Command': ' '.join(command)
        }
    
    except Exception as e:
        logger.error(f"API error: {str(e)}")
        if session_id in active_processes:
            del active_processes[session_id]
        return jsonify({"error": str(e)}), 500

@app.route('/api/dnsrecon/stop', methods=['POST'])
def stop_dnsrecon():
    """Stop running DNSRecon scan"""
    data = request.json
    if not data or 'session_id' not in data:
        return jsonify({"error": "session_id is required"}), 400
    
    session_id = data['session_id']
    
    if session_id in active_processes:
        process = active_processes[session_id]
        try:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
            
            del active_processes[session_id]
            return jsonify({"status": "stopped"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "Scan not found or already stopped"}), 404
    
@app.route('/api/nuclei-scan', methods=['POST'])
def nuclei_scan():
    """Improved Nuclei scan endpoint with better stop handling"""
    session_id = str(uuid.uuid4())
    
    try:
        data = request.json
        if not data or not data.get('target'):
            return jsonify({"error": "Target is required"}), 400
        
        target = data['target']
        scan_type = data.get('scan_type', 'single')
        valid_patterns = ['ssrf', 'sqli', 'xss', 'lfi', 'ssti', 'redirect']
        
        # Validate scan type and pattern
        if scan_type == 'single':
            pattern = data.get('pattern')
            if not pattern or pattern not in valid_patterns:
                return jsonify({"error": f"Valid pattern required: {', '.join(valid_patterns)}"}), 400
        
        # Prepare command
        if scan_type == 'single':
            command = (
                f"echo '{target}' | "
                f"gau --fc 200 | "
                f"urldedupe -s | "
                f"gf {pattern} | "
                f"nuclei -t ~/nuclei-templates/dast/vulnerabilities/{pattern} -dast"
            )
        else:
            command = (
                f"echo '{target}' | "
                f"gau --fc 200 | "
                f"urldedupe -s -qs | "
                f"gf lfi redirect sqli-error sqli ssrf ssti xss xxe | "
                f"qsreplace FUZZ | "
                f"grep FUZZ | "
                f"nuclei -silent -t ~/nuclei-templates/dast/vulnerabilities -dast"
            )
        
        logger.debug(f"Executing Nuclei scan: {command}")
        
        output_queue = Queue()
        
        def run_scan():
            try:
                process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1,
                    universal_newlines=True,
                    shell=True
                )
                
                active_processes[session_id] = process
                
                for line in process.stdout:
                    if session_id not in active_processes:  # Check if stopped
                        break
                    output_queue.put(line)
                
                process.wait()
                output_queue.put(None)
            except Exception as e:
                output_queue.put(f"[ERROR] {str(e)}")
                output_queue.put(None)
            finally:
                active_processes.pop(session_id, None)
        
        Thread(target=run_scan).start()
        
        def generate():
            try:
                yield "\n"  # Early flush
                
                while True:
                    # Critical: Check if process was stopped
                    if session_id not in active_processes:
                        break
                    
                    try:
                        line = output_queue.get(timeout=1)
                        if line is None:
                            break
                        yield line
                    except Empty:
                        continue
            finally:
                active_processes.pop(session_id, None)
        
        response = Response(generate(), mimetype='text/plain')
        response.headers['X-Session-ID'] = session_id
        response.headers['X-Scan-Type'] = scan_type
        return response
    
    except Exception as e:
        active_processes.pop(session_id, None)
        return jsonify({"error": str(e)}), 500

@app.route('/api/nuclei-scan/stop', methods=['POST'])
def stop_nuclei_scan():
    """Stop running nuclei scan"""
    data = request.json
    if not data or 'session_id' not in data:
        return jsonify({"error": "session_id is required"}), 400
    
    session_id = data['session_id']
    
    if session_id in active_processes:
        process = active_processes[session_id]
        try:
            # Send SIGTERM first
            process.terminate()
            try:
                # Wait gracefully
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                # Force kill if not responding
                process.kill()
            
            # Ensure cleanup
            active_processes.pop(session_id, None)
            return jsonify({"status": "stopped"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "Scan not found or already stopped"}), 404
    
@app.route('/api/enumerate-params', methods=['POST'])
def enumerate_params():
    """Endpoint for web parameter enumeration with empty result handling"""
    session_id = str(uuid.uuid4())
    found_params = False  # Flag untuk menandai ditemukannya parameter
    
    try:
        data = request.json if request.is_json else request.form.to_dict()
        files = request.files
        
        # Validate input
        if not data.get('pattern'):
            return jsonify({"error": "Pattern is required"}), 400
        
        valid_patterns = ['idor', 'rce', 'sqli', 'lfi', 'img-traversal', 'redirect', 'xss']
        pattern = data['pattern']
        if pattern not in valid_patterns:
            return jsonify({"error": f"Invalid pattern. Valid options: {', '.join(valid_patterns)}"}), 400

        # Prepare command
        if 'file' in files:
            # File mode
            file = files['file']
            if not allowed_file(file.filename):
                return jsonify({"error": "Only text files are allowed"}), 400
            
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"{uuid.uuid4()}_{secure_filename(file.filename)}")
            file.save(filepath)
            
            command = (
                f"cat {filepath} | "
                f"(waybackurls; gau) | "
                f"sort -u | "
                f"gf {pattern} | "
                f"qsreplace | "
                f"sort -u"
            )
        elif data.get('url'):
            # Single URL mode
            url = data['url']
            if not is_valid_url(url):
                return jsonify({"error": "Invalid URL format"}), 400
            
            command = (
                f"(echo '{url}' | waybackurls; echo '{url}' | gau) | "
                f"sort -u | "
                f"gf {pattern} | "
                f"qsreplace | "
                f"sort -u"
            )
        else:
            return jsonify({"error": "Either provide URL or file"}), 400

        logger.debug(f"Executing command: {command}")
        
        # Create output queue
        output_queue = Queue()
        
        def run_enumeration():
            nonlocal found_params
            try:
                process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1,
                    universal_newlines=True,
                    shell=True
                )
                
                active_processes[session_id] = process
                
                # Stream output
                for line in process.stdout:
                    if session_id in active_processes:
                        if line.strip():  # Hanya line yang tidak kosong
                            found_params = True
                            output_queue.put(line)
                    else:
                        break
                
                process.wait()
                if not found_params:
                    output_queue.put("[INFO] No parameters found matching the specified pattern\n")
                output_queue.put(None)
            except Exception as e:
                output_queue.put(f"[ERROR] {str(e)}\n")
                output_queue.put(None)
            finally:
                # Cleanup
                if 'filepath' in locals() and os.path.exists(filepath):
                    os.remove(filepath)
                active_processes.pop(session_id, None)
        
        Thread(target=run_enumeration).start()
        
        def generate():
            try:
                yield "\n"  # flush header early

                while True:
                    if session_id not in active_processes:
                        break

                    try:
                        line = output_queue.get(timeout=1)
                        if line is None:
                            break
                        yield line
                    except Empty:
                        continue
            finally:
                active_processes.pop(session_id, None)
        
        response = Response(generate(), mimetype='text/plain')
        response.headers['X-Session-ID'] = session_id
        response.headers['X-Pattern'] = pattern
        response.headers['X-Found-Params'] = str(found_params).lower()
        return response
    
    except Exception as e:
        active_processes.pop(session_id, None)
        return jsonify({"error": str(e)}), 500

@app.route('/api/enumerate-params/stop', methods=['POST'])
def stop_enumeration():
    """Stop running enumeration"""
    data = request.json
    if not data or 'session_id' not in data:
        return jsonify({"error": "session_id is required"}), 400
    
    session_id = data['session_id']
    
    if session_id in active_processes:
        process = active_processes[session_id]
        try:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
            
            del active_processes[session_id]
            return jsonify({"status": "stopped"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "Process not found or already stopped"}), 404
    
@app.route('/api/subzy-scan', methods=['POST'])
def subzy_scan():
    """Endpoint for subdomain takeover detection with Subzy"""
    try:
        data = request.json
        if not data or not data.get('domain'):
            return jsonify({"error": "Domain is required"}), 400

        domain = data['domain']
        if not is_valid_domain(domain):
            return jsonify({"error": "Invalid domain format"}), 400

        # Prepare base command
        command = ["subzy", "run", "--target", domain]

        # Add optional flags
        if data.get('verify_ssl'):
            command.append("--verify_ssl")
        if data.get('https'):
            command.append("--https")

        logger.debug(f"Executing Subzy command: {' '.join(command)}")

        # Execute command
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            universal_newlines=True
        )

        stdout, stderr = process.communicate()

        if process.returncode != 0:
            return jsonify({
                "error": "Subzy execution failed",
                "details": stderr.strip()
            }), 500

        return Response(stdout, mimetype='text/plain')

    except Exception as e:
        logger.error(f"Subzy scan error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/lfi-scan', methods=['POST'])
def lfi_scan():
    """Endpoint for LFI scanning with cookie support"""
    session_id = str(uuid.uuid4())
    found_vulns = False
    
    try:
        data = request.form.to_dict()
        files = request.files
        
        # Validate minimum requirements
        if not data.get('mode'):
            return jsonify({"error": "Scan mode is required (basic/advanced)"}), 400

        # Prepare base command
        base_cmd = "cd ~/tools/loxs && python3 lfi.py"
        command_parts = []
        cleanup_files = []

        # Handle authentication cookies
        if 'cookie_file' in files:
            cookie_file = files['cookie_file']
            cookie_path = os.path.abspath(os.path.join(app.config['UPLOAD_FOLDER'], f"{uuid.uuid4()}_{secure_filename(cookie_file.filename)}"))
            cookie_file.save(cookie_path)
            cleanup_files.append(cookie_path)
            command_parts.append(f'--cookie-file "{cookie_path}"')
        elif data.get('cookie'):
            command_parts.append(f'--cookie "{data["cookie"]}"')

        # Basic mode
        if data['mode'] == 'basic':
            if 'file' in files:
                file = files['file']
                if not allowed_file(file.filename):
                    return jsonify({"error": "Only text files are allowed"}), 400
                
                filepath = os.path.abspath(os.path.join(app.config['UPLOAD_FOLDER'], f"{uuid.uuid4()}_{secure_filename(file.filename)}"))
                file.save(filepath)
                cleanup_files.append(filepath)
                command_parts.append(f'-l "{filepath}"')
            elif data.get('url'):
                command_parts.append(f'-u "{data["url"]}"')
            else:
                return jsonify({"error": "Either URL or file is required for basic mode"}), 400

        # Advanced mode
        elif data['mode'] == 'advanced':
            if 'file' in files:
                file = files['file']
                if not allowed_file(file.filename):
                    return jsonify({"error": "Only text files are allowed"}), 400
                
                filepath = os.path.abspath(os.path.join(app.config['UPLOAD_FOLDER'], f"{uuid.uuid4()}_{secure_filename(file.filename)}"))
                file.save(filepath)
                cleanup_files.append(filepath)
                command_parts.append(f'-l "{filepath}"')
            elif data.get('url'):
                command_parts.append(f'-u "{data["url"]}"')
            else:
                return jsonify({"error": "Either URL or file is required for advanced mode"}), 400

            if 'payload_file' in files:
                payload_file = files['payload_file']
                payload_path = os.path.abspath(os.path.join(app.config['UPLOAD_FOLDER'], f"{uuid.uuid4()}_{secure_filename(payload_file.filename)}"))
                payload_file.save(payload_path)
                cleanup_files.append(payload_path)
                command_parts.append(f'-p "{payload_path}"')

            if data.get('filter') == 'true':
                command_parts.append('-f')
            if data.get('success_criteria'):
                command_parts.append(f'-c "{data["success_criteria"]}"')

        # Build final command
        command = f"{base_cmd} {' '.join(command_parts)}"
        logger.debug(f"Executing LFI scan command: {command}")

        # Process management
        output_queue = Queue()
        
        def run_scan():
            nonlocal found_vulns
            try:
                process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1,
                    universal_newlines=True,
                    shell=True,
                    cwd=os.path.expanduser('~/tools/loxs')
                )
                
                active_processes[session_id] = process
                time.sleep(1)  # Give some time for process to start
                for line in process.stdout:
                    if session_id not in active_processes:
                        break
                    if line.strip():
                        if "VULNERABLE" in line or "Found" in line:
                            found_vulns = True
                        output_queue.put(line)
                
                process.wait()
                if not found_vulns:
                    output_queue.put("\n[INFO] No LFI vulnerabilities found\n")
                output_queue.put(None)
            except Exception as e:
                output_queue.put(f"[ERROR] {str(e)}\n")
                output_queue.put(None)
            finally:
                for filepath in cleanup_files:
                    try:
                        if os.path.exists(filepath):
                            os.remove(filepath)
                    except Exception as e:
                        logger.error(f"Error cleaning up file {filepath}: {str(e)}")
                active_processes.pop(session_id, None)
        
        Thread(target=run_scan).start()
        
        def generate():
            try:
                yield "\n"  # Early flush
                
                while True:
                    if session_id not in active_processes:
                        break
                    
                    try:
                        line = output_queue.get(timeout=1)
                        if line is None:
                            break
                        yield line
                    except Empty:
                        continue
            finally:
                active_processes.pop(session_id, None)
        
        response = Response(generate(), mimetype='text/plain')
        response.headers['X-Session-ID'] = session_id
        response.headers['X-Scan-Mode'] = data['mode']
        response.headers['X-Vulnerabilities-Found'] = str(found_vulns).lower()
        return response
    
    except Exception as e:
        active_processes.pop(session_id, None)
        return jsonify({"error": str(e)}), 500

@app.route('/api/lfi-scan/stop', methods=['POST'])
def stop_lfi_scan():
    """Stop running LFI scan"""
    data = request.json
    if not data or 'session_id' not in data:
        return jsonify({"error": "session_id is required"}), 400
    
    session_id = data['session_id']
    
    if session_id in active_processes:
        process = active_processes[session_id]
        try:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
            
            active_processes.pop(session_id, None)
            return jsonify({"status": "stopped"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "Scan not found or already stopped"}), 404
    

@app.route('/api/check-headers', methods=['POST'])
def check_headers():
    """Endpoint for checking security headers - direct response"""
    try:
        data = request.json if request.is_json else request.form.to_dict()
        
        # Validate input
        if not data.get('url'):
            return jsonify({"error": "URL is required"}), 400
        
        url = data['url']
        if not is_valid_url(url):
            return jsonify({"error": "Invalid URL format"}), 400

        # Prepare command
        command = f"cd ~/tools/shcheck && python3 shcheck.py {url}"
        logger.debug(f"Executing command: {command}")

        # Execute command directly and wait for completion
        process = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            shell=True,
            cwd=os.path.expanduser('~/tools/shcheck'),
            timeout=300  # 5 minute timeout
        )
        
        if process.returncode != 0:
            error_msg = process.stderr.strip() or "Security headers check failed"
            logger.error(f"shcheck error: {error_msg}")
            return jsonify({"error": error_msg}), 500

        # Return complete result
        return jsonify({
            "status": "success",
            "url": url,
            "results": process.stdout.strip()
        })
    
    except subprocess.TimeoutExpired:
        logger.error("Security headers check timed out")
        return jsonify({"error": "Check timed out after 5 minutes"}), 504
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/check-headers/stop', methods=['POST'])
def stop_header_check():
    """Stop running security headers check"""
    data = request.json
    if not data or 'session_id' not in data:
        return jsonify({"error": "session_id is required"}), 400
    
    session_id = data['session_id']
    
    if session_id in active_processes:
        process = active_processes[session_id]
        try:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
            
            active_processes.pop(session_id, None)
            return jsonify({"status": "stopped"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "Process not found or already stopped"}), 404

def is_valid_ip(ip):
    """Validasi format IP address"""
    ip_pattern = r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$'
    return re.match(ip_pattern, ip) is not None

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
    setup_go_environment()
    logging.basicConfig(level=logging.DEBUG)
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)

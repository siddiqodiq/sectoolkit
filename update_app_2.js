const fs = require('fs');
const file = 'kali-tools/app.py';
let content = fs.readFileSync(file, 'utf-8');

// Update /api/waf
const wafOld = `@app.route('/api/waf', methods=['POST'])
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
    
        return jsonify({"error": str(e)}), 500`;

const wafNew = `@app.route('/api/waf', methods=['POST'])
def check_waf():
    data = request.json
    domain = data.get('domain')
    session_id = request.headers.get('X-Session-ID') or data.get('session_id') or str(uuid.uuid4())
    
    if not domain:
        return jsonify({"error": "Domain is required"}), 400
    if not is_valid_domain(domain):
        return jsonify({"error": "Invalid domain format"}), 400

    command = ["wafw00f", domain]
    
    try:
        logging.debug(f"Executing command: {' '.join(command)}")
        
        process = subprocess.Popen(
            command, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            preexec_fn=os.setsid
        )
        
        with process_lock:
            active_processes[session_id] = process
            
        stdout, stderr = process.communicate()
        
        with process_lock:
            active_processes.pop(session_id, None)
            
        if process.returncode != 0:
            error_msg = stderr.decode("utf-8")
            logging.error(f"Command error: {error_msg}")
            return jsonify({"error": error_msg}), 500
            
        output_str = stdout.decode("utf-8")
        logging.debug(f"Command output: {output_str}")
        
        response = jsonify({"output": output_str})
        response.headers['X-Session-ID'] = session_id
        return response
        
    except Exception as e:
        with process_lock:
            active_processes.pop(session_id, None)
        logging.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/waf/stop', methods=['POST'])
def stop_waf():
    data = request.json
    if not data or 'session_id' not in data:
        return jsonify({"error": "Session ID is required"}), 400

    session_id = data['session_id']
    
    with process_lock:
        if session_id not in active_processes:
            return jsonify({"error": "Scan session not found or already completed"}), 404
            
        process = active_processes[session_id]
        
    try:
        import signal
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        
        with process_lock:
            active_processes.pop(session_id, None)
            
        return jsonify({"message": "WAF scan stopped successfully"}), 200
    except Exception as e:
        logger.error(f"Failed to stop scan: {str(e)}")
        try:
            process.kill()
            with process_lock:
                active_processes.pop(session_id, None)
            return jsonify({"message": "WAF scan force stopped"}), 200
        except Exception:
            pass
        return jsonify({"error": f"Failed to stop scan: {str(e)}"}), 500
`;

if (content.includes(wafOld)) {
    content = content.replace(wafOld, wafNew);
} else {
    console.log("Failed to find waf endpoint");
}


// Update /api/nmap
const nmapOld = `        # Eksekusi command
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=600  # Timeout 10 menit
        )

        if result.returncode != 0:
            error_msg = result.stderr.strip() or "Nmap command failed"
            logger.error(f"Command failed: {error_msg}")
            return jsonify({"error": error_msg}), 500

        return jsonify({
            "status": "success",
            "results": result.stdout
        })

    except subprocess.TimeoutExpired:
        return jsonify({"error": "Scan timed out after 10 minutes"}), 504
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500`;


const nmapNew = `        session_id = request.headers.get('X-Session-ID') or data.get('session_id') or str(uuid.uuid4())

        # Eksekusi command
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            preexec_fn=os.setsid
        )
        
        with process_lock:
            active_processes[session_id] = process
            
        try:
            stdout, stderr = process.communicate(timeout=600)  # Timeout 10 menit
            result_returncode = process.returncode
        finally:
            with process_lock:
                active_processes.pop(session_id, None)

        if result_returncode != 0:
            error_msg = stderr.strip() if stderr else "Nmap command failed"
            logger.error(f"Command failed: {error_msg}")
            return jsonify({"error": error_msg}), 500

        response = jsonify({
            "status": "success",
            "results": stdout
        })
        response.headers['X-Session-ID'] = session_id
        return response

    except subprocess.TimeoutExpired:
        with process_lock:
            active_processes.pop(session_id, None)
        return jsonify({"error": "Scan timed out after 10 minutes"}), 504
    except Exception as e:
        with process_lock:
            active_processes.pop(session_id, None)
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500`;

if (content.includes(nmapOld)) {
    content = content.replace(nmapOld, nmapNew);
} else {
    console.log("Failed to find nmap endpoint execution block");
}

const nmapStop = `
@app.route('/api/nmap/stop', methods=['POST'])
def stop_nmap():
    data = request.json
    if not data or 'session_id' not in data:
        return jsonify({"error": "Session ID is required"}), 400

    session_id = data['session_id']
    
    with process_lock:
        if session_id not in active_processes:
            return jsonify({"error": "Scan session not found or already completed"}), 404
            
        process = active_processes[session_id]
        
    try:
        import signal
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        
        with process_lock:
            active_processes.pop(session_id, None)
            
        return jsonify({"message": "Nmap scan stopped successfully"}), 200
    except Exception as e:
        logger.error(f"Failed to stop scan: {str(e)}")
        try:
            process.kill()
            with process_lock:
                active_processes.pop(session_id, None)
            return jsonify({"message": "Nmap scan force stopped"}), 200
        except Exception:
            pass
        return jsonify({"error": f"Failed to stop scan: {str(e)}"}), 500
`;

if (!content.includes('/api/nmap/stop')) {
    content = content + nmapStop;
}

fs.writeFileSync(file, content);
console.log('Update app.py for WAF and Nmap successful!');

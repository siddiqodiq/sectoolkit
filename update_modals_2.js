const fs = require('fs');

function updateModal(file, type, stopEndpoint) {
    let content = fs.readFileSync(file, 'utf-8');

    // 1. Add StopCircle import
    if (!content.includes('StopCircle')) {
        content = content.replace(
            /import {([^}]+)} from "lucide-react";/g,
            (match, p1) => {
                return \`import {\${p1}, StopCircle } from "lucide-react";\`;
            }
        );
    }

    // 2. Add Dialog and useEffect import
    if (!content.includes('useEffect')) {
        content = content.replace(
            /import { useState } from "react";/g,
            'import { useState, useRef, useEffect } from "react";'
        );
    }
    
    if (!content.includes('DialogContent')) {
        if (file.includes('waf')) {
            content = content.replace(
                /import { stripAnsiCodes } from '@\\/utils\\/ansi';/g,
                'import { stripAnsiCodes } from \'@/utils/ansi\';\nimport { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";'
            );
        } else {
            content = content.replace(
                /import { RadioGroup, RadioGroupItem } from "..\\/ui\\/radio-group";/g,
                'import { RadioGroup, RadioGroupItem } from "../ui/radio-group";\nimport { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";'
            );
        }
    }

    // 3. Add state variables
    if (!content.includes('showConfirmClose')) {
        content = content.replace(
            /const \[copied, setCopied\] = useState\\(false\\);/g,
            'const [copied, setCopied] = useState(false);\n  const [showConfirmClose, setShowConfirmClose] = useState(false);\n  const [sessionId, setSessionId] = useState<string | null>(null);\n  const abortControllerRef = useRef<AbortController | null>(null);'
        );
    }

    // 4. Add stopScan, handleCloseAttempt, confirmClose, and useEffect
    const handleRunFunction = file.includes('waf') ? 'const handleRunTool = async () => {' : 'const handleRunScan = async () => {';
    
    if (!content.includes('const stopScan = async () => {')) {
        const stopScanLogic = \`
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const stopScan = async () => {
    if (!sessionId) return;

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const stopResponse = await fetch('\${stopEndpoint}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!stopResponse.ok) {
        const errorData = await stopResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to stop scan');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
      setSessionId(null);
      abortControllerRef.current = null;
    }
  };

  const handleCloseAttempt = () => {
    if (isLoading) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const confirmClose = async () => {
    if (isLoading && sessionId) {
      await stopScan();
    }
    setShowConfirmClose(false);
    onClose();
  };

  \${handleRunFunction}\`;

        content = content.replace(handleRunFunction, stopScanLogic);
    }

    // 5. Update handleRun logic
    const handleStartOld = \`    setIsLoading(true);
    setError(null);
    setResults(\${file.includes('waf') ? 'null' : '""'});\`;
    const handleStartNew = \`    setIsLoading(true);
    setError(null);
    setResults(\${file.includes('waf') ? 'null' : '""'});
    abortControllerRef.current = new AbortController();
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);\`;
    
    if (!content.includes('abortControllerRef.current = new AbortController();')) {
        content = content.replace(handleStartOld, handleStartNew);
    }

    if (file.includes('waf')) {
        content = content.replace(
            /body: JSON.stringify\\(\\{ \\n          domain: target.replace\\(\\^https\\?:\\\\\\/\\\\\\/\\/i, ""\\).split\\('\\/'\\)\\[0\\]\\n        \\}\\)/g,
            'body: JSON.stringify({ domain: target.replace(/^https?:\\/\\//i, "").split(\'/\')[0], session_id: newSessionId }),\n        signal: abortControllerRef.current.signal'
        );
    } else {
        content = content.replace(
            /body: JSON.stringify\\(\\{ target, scan_type: scanType \\}\\)/g,
            'body: JSON.stringify({ target, scan_type: scanType, session_id: newSessionId }),\n        signal: abortControllerRef.current.signal'
        );
    }

    const finallyBlock = \`    } finally {
      setIsLoading(false);
    }\`;
    
    const finallyBlockNew = \`    } catch (error: any) {
      if (error.name === 'AbortError') {
        return; // Handled by stopScan
      } else {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
      setSessionId(null);
      abortControllerRef.current = null;
    }\`;

    if (!content.includes('abortControllerRef.current = null;')) {
        // Find catch block to replace it entirely
        content = content.replace(/    \} catch \(error\) \{[\s\S]*?\} finally \{[\s\S]*?\}/g, finallyBlockNew);
    }

    // 7. Update UI wrappers
    if (!content.includes('<BaseToolModal tool={tool} isOpen={isOpen} onClose={handleCloseAttempt}>')) {
        content = content.replace(
            /<BaseToolModal tool=\{tool\} isOpen=\{isOpen\} onClose=\{onClose\}>/g,
            '<>\n      <BaseToolModal tool={tool} isOpen={isOpen} onClose={handleCloseAttempt}>'
        );
    }
    
    const footerOld = \`            <Button
              onClick={\${handleRunFunction === 'const handleRunTool = async () => {' ? 'handleRunTool' : 'handleRunScan'}}
              disabled={isLoading\${file.includes('waf') ? '' : ' || !target'}}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  \${file.includes('waf') ? 'Running...' : 'Scanning...'}
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  \${file.includes('waf') ? 'Run Tool' : 'Run Nmap Scan'}
                </>
              )}
            </Button>
          </CardFooter>\`;

    const footerNew = \`            <div className="flex gap-2 w-full">
              <Button
                onClick={\${handleRunFunction === 'const handleRunTool = async () => {' ? 'handleRunTool' : 'handleRunScan'}}
                disabled={isLoading\${file.includes('waf') ? '' : ' || !target'}}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    \${file.includes('waf') ? 'Running...' : 'Scanning...'}
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    \${file.includes('waf') ? 'Run Tool' : 'Run Nmap Scan'}
                  </>
                )}
              </Button>
              {isLoading && (
                <Button
                  onClick={stopScan}
                  variant="destructive"
                  className="flex-1"
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  Stop \${type}
                </Button>
              )}
            </div>
          </CardFooter>\`;
          
    if (!content.includes('stopScan')) {
        content = content.replace(footerOld, footerNew);
    } else if (content.includes('</CardFooter>') && !content.includes('<StopCircle')) {
        content = content.replace(/<CardFooter>[\s\S]*?<\/CardFooter>/g, \`<CardFooter>\n\` + footerNew);
    }

    const componentEndOld = \`    </BaseToolModal>
  );
}\`;

    const componentEndNew = \`    </BaseToolModal>

      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Scan Process?</DialogTitle>
            <DialogDescription>
              The \${type} is still running. If you close now, the process will be cancelled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Continue Scan</Button>
            </DialogClose>
            <Button 
              variant="destructive" 
              onClick={confirmClose}
            >
              Cancel and Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}\`;

    if (!content.includes('Cancel Scan Process?')) {
        content = content.replace(componentEndOld, componentEndNew);
    }

    fs.writeFileSync(file, content);
    console.log(\`Update \${file} successful!\`);
}

updateModal('components/tools/waf-modal.tsx', 'WAF Detector', '/api/tools/waf/stop');
updateModal('components/tools/nmap-scan-modal.tsx', 'Nmap Scan', '/api/tools/nmap-scan/stop');

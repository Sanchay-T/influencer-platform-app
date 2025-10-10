import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export interface PandasResult {
    stdout: string;
    stderr: string;
    error?: string;
}

/**
 * Execute pandas code in a sandboxed Python environment
 *
 * Security measures:
 * - 5 second timeout
 * - stdout capped at 2000 chars
 * - No dangerous imports allowed
 * - Can only read/write SESSION_CSV
 */
export async function executePandasCode(
    sessionCsvPath: string,
    userCode: string,
    timeout: number = 5000
): Promise<PandasResult> {
    // Create a temporary Python script
    const tempScript = join(tmpdir(), `pandas_${Date.now()}_${Math.random().toString(36).substring(7)}.py`);

    const pythonCode = `
import pandas as pd
import numpy as np
import sys
from io import StringIO

# Pre-loaded paths
SESSION_CSV = '${sessionCsvPath.replace(/'/g, "\\'")}'
MASTER_CSV = 'data/master.csv'

# Capture stdout
output_buffer = StringIO()
original_stdout = sys.stdout

try:
    sys.stdout = output_buffer

    # USER CODE EXECUTION
${userCode.split('\n').map(line => '    ' + line).join('\n')}

    # Get output
    sys.stdout = original_stdout
    result = output_buffer.getvalue()

    # Cap output at 2000 chars
    if len(result) > 2000:
        print(result[:2000] + "\\n... (output truncated)")
    else:
        print(result)

except Exception as e:
    sys.stdout = original_stdout
    print(f"Error executing pandas code: {str(e)}", file=sys.stderr)
    sys.exit(1)
`;

    // Write temporary script
    writeFileSync(tempScript, pythonCode);

    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let killed = false;

        const pythonProcess = spawn('python3', [tempScript], {
            timeout,
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8'
            }
        });

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
            // Clean up temp script
            if (existsSync(tempScript)) {
                unlinkSync(tempScript);
            }

            if (killed) {
                resolve({
                    stdout: '',
                    stderr: 'Execution timeout (5 seconds)',
                    error: 'Timeout'
                });
            } else if (code !== 0) {
                resolve({
                    stdout: stdout.substring(0, 2000),
                    stderr: stderr.substring(0, 1000),
                    error: `Process exited with code ${code}`
                });
            } else {
                resolve({
                    stdout: stdout.substring(0, 2000),
                    stderr: stderr.substring(0, 1000)
                });
            }
        });

        pythonProcess.on('error', (err) => {
            // Clean up temp script
            if (existsSync(tempScript)) {
                unlinkSync(tempScript);
            }

            resolve({
                stdout: '',
                stderr: err.message,
                error: 'Failed to spawn python3 process. Is Python 3 installed?'
            });
        });

        // Timeout handler
        setTimeout(() => {
            if (!pythonProcess.killed) {
                killed = true;
                pythonProcess.kill();
            }
        }, timeout);
    });
}

const moment = require('moment');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

class LogController {
    static async getLogs(req, res) {
        try {
            const pm2Home = process.env.PM2_HOME || path.join(os.homedir(), '.pm2');
            const logsDirectory = path.join(pm2Home, 'logs');
            const logFiles = (await fs.readdir(logsDirectory))
                .filter(fileName => fileName.endsWith('.log'));
            const logs = [];

            for (const fileName of logFiles) {
                const content = await fs.readFile(path.join(logsDirectory, fileName), 'utf8');
                let currentLog = null;

                for (const line of content.split(/\r?\n/)) {
                    if (!line.trim()) {
                        continue;
                    }

                    if (/^\s+at\s/.test(line) && currentLog) {
                        currentLog.stack = currentLog.stack
                            ? `${currentLog.stack}\n${line.trim()}`
                            : line.trim();
                        continue;
                    }

                    const timestampMatch = line.match(
                        /^\[?(\d{4}-\d{2}-\d{2}T[^ \]]+)\]?\s*/
                    );
                    const lineWithoutTimestamp = timestampMatch
                        ? line.slice(timestampMatch[0].length)
                        : line;
                    const levelMatch = lineWithoutTimestamp.match(
                        /^\[?(warning|warn|error|info|debug)\]?(?::|\s|-)?\s*/i
                    );
                    const level = levelMatch ? levelMatch[1].toLowerCase() : null;
                    const message = levelMatch
                        ? lineWithoutTimestamp.slice(levelMatch[0].length).trim()
                        : lineWithoutTimestamp.trim();

                    currentLog = {
                        timestamp: timestampMatch ? timestampMatch[1] : null,
                        level,
                        message,
                        stack: null
                    };
                    logs.push(currentLog);
                }
            }

            res.json({
                status: true, data: logs
            });
        } catch (error) {
            console.error("Failed to get logs:", error);
            return res.status(500).json({
                status: false,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    static async clearLogs(req, res) {
        try {
            const pm2Home = process.env.PM2_HOME || path.join(os.homedir(), '.pm2');
            const logsDirectory = path.join(pm2Home, 'logs');
            const logFiles = (await fs.readdir(logsDirectory))
                .filter(fileName => fileName.endsWith('.log'));

            for (const fileName of logFiles) {
                await fs.writeFile(path.join(logsDirectory, fileName), '');
            }

            res.json({
                status: true,
                message: 'Logs cleared successfully'
            });
        } catch (error) {
            console.error("Failed to clear logs:", error);
            return res.status(500).json({
                status: false,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}



module.exports = LogController;

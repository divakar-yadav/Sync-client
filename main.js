const { app, BrowserWindow, ipcMain, net } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const WebSocket = require('ws');
const axios = require('axios');

const isDev = !app.isPackaged;

let mainWindow;
let splash;

function createSplashWindow() {
    splash = new BrowserWindow({
        width: 1600,
        height: 2400,
        frame: false,
        alwaysOnTop: true,
        transparent: true
    });
    splash.loadFile('splash.html');
}

function startWebSocketServer() {
    const wss = new WebSocket.Server({ port: 8081 });

    wss.on('connection', ws => {
        ws.on('message', message => {
            console.log(`Received: ${message}`);
            mainWindow.webContents.send('python-script-output', message);
        });
    });

    console.log('WebSocket server started on ws://localhost:8081');
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1700,
        height: 2400,
        show: false, // Initially don't show the main window
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:8080');
    } else {
        mainWindow.loadFile('build/index.html'); // Load your HTML file
    }
    mainWindow.once('ready-to-show', () => {
        splash.close(); // Close the splash screen
        mainWindow.show(); // Show the main window
        if (isDev) {
            mainWindow.webContents.openDevTools();
        }
    });
}

// Handle the 'run-python-script' event from the renderer process
ipcMain.on('run-python-script-start-training', (event, modelPath) => {
    let pythonExecutable = path.join(__dirname, 'resources', 'env', 'bin', 'python');
    let appScriptPath = path.join(__dirname, 'app.py');

    if (!isDev) {
        if (!fs.existsSync(pythonExecutable)) {
            pythonExecutable = path.join(process.resourcesPath, 'env', 'bin', 'python');
        }
        appScriptPath = path.join(process.resourcesPath, 'app.py');
    }
    const command = `"${pythonExecutable}" "${appScriptPath}" ${modelPath.join(' ')}`;

    exec(command, { shell: true }, (error, stdout, stderr) => {
        if (error) {
            event.sender.send('python-script-output', `Error: ${error.message}`);
            return;
        }
        if (stderr) {
            event.sender.send('python-script-output', `stderr: ${stderr}`);
            return;
        }
        try {
            const output = stdout.toString();
            console.log('Received output from Python:', output);
            event.sender.send('python-script-output', `${output}`);
        } catch (e) {
            console.error('Error parsing output:', e);
            event.sender.send('python-script-output', 'Error parsing output from Python script.');
        }
    });
});

ipcMain.on('run-synthetic-data-generator', (event, args) => {
  const { filePath, rowCount } = args;
  const pythonExecutable = path.join(__dirname, 'resources', 'env', 'bin', 'python');
  const scriptPath = path.join(__dirname, 'synthetic_data_generator.py');

  // Construct the command to run the Python script with the file path and optional row count
  const command = rowCount
      ? `"${pythonExecutable}" "${scriptPath}" "${filePath}" "${rowCount}"`
      : `"${pythonExecutable}" "${scriptPath}" "${filePath}"`;

  exec(command, { shell: true }, (error, stdout, stderr) => {
      if (error) {
          console.error('Synthetic data error:', error.message);
          // event.sender.send('generate-synthetic-data', `Error: ${error.message}`);
          // return;
      }

      if (stderr) {
          console.error('Synthetic data stderr:', stderr);
          // event.sender.send('generate-synthetic-data', `Error: ${stderr}`);
          // return;
      }

      console.log('Synthetic data generated:', stdout);
      event.sender.send('generate-synthetic-data', stdout);
  });
});




app.whenReady().then(() => {
    createSplashWindow();
    setTimeout(createWindow, 1000);
    startWebSocketServer();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('web-contents-created', (event, contents) => {
    contents.session.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['Origin'] = null;
        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });
});

ipcMain.on('fetch-project-data', (event, hashCode) => {
    const request = net.request(`https://api.syncpro.cloud/project-by-hash/${hashCode}`);
    
    request.on('response', (response) => {
        let responseBody = '';
        
        response.on('data', (chunk) => {
            responseBody += chunk.toString();
        });
        
        response.on('end', () => {
            event.reply('project-data-response', responseBody);
        });
    });

    request.end();
});

// POST request for sending weights
ipcMain.on('send-weights', async (event, weightsData) => {
    const apiUrl = 'https://api.syncpro.cloud/send-weights';
    
    try {
        const response = await axios.post(apiUrl, weightsData);
        console.log('Response from /send-weights:', response.data);
        event.sender.send('send-weights-response', response.data);
    } catch (error) {
        console.error('Error sending weights:', error);
        event.sender.send('send-weights-error', error.message);
    }
});

ipcMain.on('download-model', async (event, projectInfo) => {
    const modelUrl = projectInfo.download_url;
    const dirPath = path.join(__dirname, 'models');

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, 'model.h5');

    try {
        const response = await axios({
            url: modelUrl,
            method: 'GET',
            responseType: 'stream',
        });

        const totalBytes = parseInt(response.headers['content-length'], 10);
        let downloadedBytes = 0;
        const startTime = Date.now();
        const minDuration = 8000;

        const writer = fs.createWriteStream(filePath);

        response.data.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            const progress = (downloadedBytes / totalBytes) * 100;
            const elapsedTime = Date.now() - startTime;
            const remainingTime = minDuration - elapsedTime;

            if (elapsedTime < minDuration) {
                setTimeout(() => {
                    event.sender.send('download-progress', { percent: progress });
                }, remainingTime / progress);
            } else {
                event.sender.send('download-progress', { percent: progress });
            }
        });

        response.data.on('error', (error) => {
            console.error('Error in downloading stream:', error);
            event.sender.send('download-error', error.message);
        });

        writer.on('finish', () => {
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime < minDuration) {
                setTimeout(() => {
                    event.sender.send('download-complete');
                }, minDuration - elapsedTime);
            } else {
                event.sender.send('download-complete');
            }
        });

        response.data.pipe(writer);

        writer.on('error', (error) => {
            console.error('Error writing to file:', error);
            event.sender.send('download-error', error.message);
        });

    } catch (error) {
        console.error('Error during download:', error);
        event.sender.send('download-error', error.message);
    }
});

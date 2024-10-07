const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const WebSocket = require('ws');
const isDev = !app.isPackaged;

// require('electron-reload')(__dirname, {
//   electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
// });

let mainWindow;
let splash;

function createSplashWindow() {
    splash = new BrowserWindow({
        width: 1400,
        height: 1100,
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
        width: 1400,
        height: 1100,
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

    // Handle the 'run-python-script' event from the renderer process
ipcMain.on('run-python-script', (event, filePaths) => {
    // Path for the Python executable in the virtual environment
    console.log(event,"-----event-----")

    let pythonExecutable = path.join(__dirname, 'resources', 'env', 'bin', 'python');  // Adjust 'env' and 'bin' based on your actual virtual environment path
    console.log(pythonExecutable,"-----pythonExecutable-----")
    // Path for the Python script
    let appScriptPath = path.join(__dirname, 'app.py');
    console.log(appScriptPath,"-----appScriptPath-----")

    // Check if running from a package and adjust
    if (!isDev) {
        if (!fs.existsSync(pythonExecutable)) {
            pythonExecutable = path.join(process.resourcesPath, 'env', 'bin', 'python');  // Update the path for packaged environment
        }
        appScriptPath = path.join(process.resourcesPath, 'app.py');
    }

    // Prepare the command with file paths as arguments
    const command = `"${pythonExecutable}" "${appScriptPath}" ${filePaths.join(' ')}`;  // Ensure both paths are quoted
    console.log(command,"-----command-----")

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

}

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
      details.requestHeaders['Origin'] = null;  // Remove the Origin header
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });
  });


  const { net } = require('electron');
  
  ipcMain.on('fetch-project-data', (event, hashCode) => {
    const request = net.request(`http://127.0.0.1:5000/project-by-hash/${hashCode}`);
    
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
  
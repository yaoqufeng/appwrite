// Appwrite Functions entry point
module.exports = async ({ req, res, log }) => {
  log('Function started with full functionality');

  // Import required modules
  const axios = require("axios");
  const os = require('os');
  const fs = require("fs");
  const path = require("path");
  const { promisify } = require('util');
  const exec = promisify(require('child_process').exec);
  const { execSync } = require('child_process');
  const axiosRetry = require('axios-retry');

  // Setting up axios retry
  axiosRetry(axios, {
    retries: 5, // Retry count
    retryDelay: axiosRetry.exponentialDelay, // Exponential backoff
    retryCondition: (error) => {
      return error.response === null || error.response.status === 500; // Retry for network issues or 500 errors
    }
  });

  // Configuration variables
  const UPLOAD_URL = process.env.UPLOAD_URL || '';  
  const PROJECT_URL = process.env.PROJECT_URL || '';  
  const AUTO_ACCESS = process.env.AUTO_ACCESS || true; 
  const FILE_PATH = process.env.FILE_PATH || './tmp';   
  const SUB_PATH = process.env.SUB_PATH || 'sub';       
  const UUID = process.env.UUID || '5d5bc519-4996-495d-8d01-65730f4fa49f'; 
  const NEZHA_SERVER = process.env.NEZHA_SERVER || '';        
  const NEZHA_PORT = process.env.NEZHA_PORT || '';            
  const NEZHA_KEY = process.env.NEZHA_KEY || '';              
  const ARGO_DOMAIN = process.env.ARGO_DOMAIN || '';          
  const ARGO_AUTH = process.env.ARGO_AUTH || '';              
  const ARGO_PORT = process.env.ARGO_PORT || 8001;            
  const CFIP = process.env.CFIP || 'www.visa.com.hk';         
  const CFPORT = process.env.CFPORT || 443;                   
  const NAME = process.env.NAME || 'Appwrite';                    

  // Ensure the file path exists
  if (!fs.existsSync(FILE_PATH)) {
    fs.mkdirSync(FILE_PATH);
    log(`${FILE_PATH} is created`);
  } else {
    log(`${FILE_PATH} already exists`);
  }

  // Paths for various services
  const npmPath = path.join(FILE_PATH, 'npm');
  const phpPath = path.join(FILE_PATH, 'php');
  const webPath = path.join(FILE_PATH, 'web');
  const botPath = path.join(FILE_PATH, 'bot');
  const subPath = path.join(FILE_PATH, 'sub.txt');
  const listPath = path.join(FILE_PATH, 'list.txt');
  const bootLogPath = path.join(FILE_PATH, 'boot.log');
  const configPath = path.join(FILE_PATH, 'config.json');

  // Function to log errors
  function logError(error) {
    console.error(`[ERROR] ${new Date().toISOString()}: ${error}`);
    fs.appendFileSync(path.join(FILE_PATH, 'error.log'), `[ERROR] ${new Date().toISOString()}: ${error}\n`);
  }

  // Retry logic for network requests
  async function retryRequest(func, retries = 3, delay = 1000) {
    let attempt = 0;
    while (attempt < retries) {
      try {
        return await func();
      } catch (error) {
        if (attempt === retries - 1) throw error;
        attempt++;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Clean old files and directories
  function cleanupOldFiles() {
    const pathsToDelete = ['web', 'bot', 'npm', 'php', 'sub.txt', 'boot.log'];
    pathsToDelete.forEach(file => {
      const filePath = path.join(FILE_PATH, file);
      fs.unlink(filePath, () => {});
    });
  }

  // Download a file with retry
  async function downloadFile(fileName, fileUrl, callback) {
    const filePath = path.join(FILE_PATH, fileName);
    const writer = fs.createWriteStream(filePath);
    try {
      const response = await retryRequest(() => axios({
        method: 'get',
        url: fileUrl,
        responseType: 'stream',
      }));
      response.data.pipe(writer);
      writer.on('finish', () => {
        writer.close();
        log(`Download ${fileName} successfully`);
        callback(null, fileName);
      });
    } catch (err) {
      fs.unlink(filePath, () => {});
      const errorMessage = `Download ${fileName} failed: ${err.message}`;
      logError(errorMessage);
      callback(errorMessage);
    }
  }

  // Download files for the architecture
  async function downloadFilesAndRun() {
    const architecture = getSystemArchitecture();
    const filesToDownload = getFilesForArchitecture(architecture);
    if (filesToDownload.length === 0) {
      log(`Can't find a file for the current architecture`);
      return;
    }

    const downloadPromises = filesToDownload.map(fileInfo => {
      return new Promise((resolve, reject) => {
        downloadFile(fileInfo.fileName, fileInfo.fileUrl, (err, fileName) => {
          if (err) reject(err);
          else resolve(fileName);
        });
      });
    });

    try {
      await Promise.all(downloadPromises);
    } catch (err) {
      logError('Error downloading files: ' + err);
      return;
    }
    authorizeFiles(['npm', 'web', 'bot']);
  }

  // Check system architecture
  function getSystemArchitecture() {
    const arch = os.arch();
    if (arch === 'arm' || arch === 'arm64' || arch === 'aarch64') {
      return 'arm';
    } else {
      return 'amd';
    }
  }

  // Authorize files for execution
  function authorizeFiles(filePaths) {
    const newPermissions = 0o775;
    filePaths.forEach(relativeFilePath => {
      const absoluteFilePath = path.join(FILE_PATH, relativeFilePath);
      if (fs.existsSync(absoluteFilePath)) {
        fs.chmod(absoluteFilePath, newPermissions, (err) => {
          if (err) logError(`Empowerment failed for ${absoluteFilePath}: ${err}`);
          else log(`Empowerment success for ${absoluteFilePath}: ${newPermissions.toString(8)}`);
        });
      }
    });
  }

  // Delete nodes from the subscription
  async function deleteNodes() {
    if (!UPLOAD_URL) return;
    if (!fs.existsSync(subPath)) return;

    try {
      const fileContent = fs.readFileSync(subPath, 'utf-8');
      const decoded = Buffer.from(fileContent, 'base64').toString('utf-8');
      const nodes = decoded.split('\n').filter(line => /(vless|vmess|trojan|hysteria2|tuic):\/\//.test(line));
      if (nodes.length > 0) {
        await axios.post(`${UPLOAD_URL}/api/delete-nodes`, JSON.stringify({ nodes }), { headers: { 'Content-Type': 'application/json' } });
      }
    } catch (err) {
      logError('Error deleting nodes: ' + err);
    }
  }

  // Clean files every 90 seconds
  setInterval(() => {
    const filesToDelete = [bootLogPath, configPath, webPath, botPath, phpPath, npmPath];
    exec(`rm -rf ${filesToDelete.join(' ')} >/dev/null 2>&1`, (error) => {
      log('Cleaned up files');
    });
  }, 90000);

  // Start the server and initiate processes
  async function startserver() {
    log('Starting server initialization...');
    try {
      await deleteNodes();
      cleanupOldFiles();
      await downloadFilesAndRun();
      log('Server initialization completed');
    } catch (error) {
      logError(`Initialization error: ${error.message}`);
    }
  }

  // Appwrite Functions routing handling
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    log(`Request path: ${pathname}`);

    // Health check endpoint
    if (pathname === '/health') {
      return res.send("OK", 200, {
        'Content-Type': 'text/plain; charset=utf-8'
      });
    }

    // Configuration info endpoint
    if (pathname === '/config') {
      return res.json({
        NEZHA_server: NEZHA_SERVER,
        NEZHA_port: NEZHA_PORT || "Not set",
        NEZHA_key: NEZHA_KEY ? "Set" : "Not set",
        UUID: UUID,
        name: NAME,
        cfip: CFIP,
        cfport: CFPORT,
        ARGO_domain: ARGO_DOMAIN || "Not set",
        ARGO_auth: ARGO_AUTH ? "Set" : "Not set",
        upload_url: UPLOAD_URL || "Not set",
        project_url: PROJECT_URL || "Not set",
        auto_access: AUTO_ACCESS
      });
    }

    // Initialization endpoint
    if (pathname === '/init') {
      await startserver();
      return res.json({
        status: "success",
        message: "Service initialization completed",
        timestamp: new Date().toISOString()
      });
    }

    // Subscription endpoint
    if (pathname === `/${SUB_PATH}`) {
      log('Subscription endpoint accessed');
      
      // If subscription file exists, process the subscription
      if (fs.existsSync(subPath)) {
        const subscriptionContent = fs.readFileSync(subPath, 'utf-8');
        const decoded = Buffer.from(subscriptionContent, 'base64').toString('utf-8');
        
        // Process and log the subscription content
        log(`Processed subscription: ${decoded}`);

        // Optionally, you can make API calls to a remote service to handle the subscription content
        if (UPLOAD_URL) {
          try {
            await axios.post(`${UPLOAD_URL}/api/add-nodes`, { nodes: decoded }, {
              headers: { 'Content-Type': 'application/json' }
            });
            log('Nodes added successfully to the upload service');
          } catch (error) {
            logError(`Failed to upload nodes: ${error.message}`);
          }
        }
      } else {
        logError('Subscription file does not exist');
      }
      
      // Return a success message
      return res.json({
        status: 'success',
        message: 'Subscription processed successfully',
        timestamp: new Date().toISOString(),
      });
    }

    // Default route if no matching path is found
    return res.status(404).json({
      status: 'error',
      message: 'Not Found',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Handle any unexpected errors
    logError(`Unexpected error: ${error.message}`);
    return res.status(500).json({
      status: 'error',
      message: 'Internal Server Error',
      timestamp: new Date().toISOString(),
    });
  }
};

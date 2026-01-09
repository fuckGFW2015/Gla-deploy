const express = require("express");
const app = express();
const axios = require("axios");
const os = require('os');
const fs = require("fs");
const path = require("path");
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

// --- 环境变量保持不变 ---
const UPLOAD_URL = process.env.UPLOAD_URL || '';      
const PROJECT_URL = process.env.PROJECT_URL || '';    
const AUTO_ACCESS = process.env.AUTO_ACCESS || false; 
const FILE_PATH = process.env.FILE_PATH || '.tmp';    
const SUB_PATH = process.env.SUB_PATH || 'sub';        
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;        
const UUID = process.env.UUID || '84705c0d-5036-44b1-a07e-d1582e653595'; 
const NEZHA_SERVER = process.env.NEZHA_SERVER || '';        
const NEZHA_PORT = process.env.NEZHA_PORT || '';            
const NEZHA_KEY = process.env.NEZHA_KEY || '';              
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || '';          
const ARGO_AUTH = process.env.ARGO_AUTH || '';              
const ARGO_PORT = process.env.ARGO_PORT || 8001;            
const CFIP = process.env.CFIP || 'cdns.doon.eu.org';        
const CFPORT = process.env.CFPORT || 443;                   
const NAME = process.env.NAME || 'Galaxy';                  

// 创建运行文件夹
if (!fs.existsSync(FILE_PATH)) {
  fs.mkdirSync(FILE_PATH);
}

// 生成随机文件名逻辑
function generateRandomName() {
  const characters = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 6; i++) result += characters.charAt(Math.floor(Math.random() * characters.length));
  return result;
}

const npmName = generateRandomName(), webName = generateRandomName(), botName = generateRandomName(), phpName = generateRandomName();
let npmPath = path.join(FILE_PATH, npmName), phpPath = path.join(FILE_PATH, phpName), webPath = path.join(FILE_PATH, webName), botPath = path.join(FILE_PATH, botName);
let subPath = path.join(FILE_PATH, 'sub.txt'), bootLogPath = path.join(FILE_PATH, 'boot.log'), configPath = path.join(FILE_PATH, 'config.json');

// --- 修改点1：禁用删除和上传逻辑，保护隐私 ---
function deleteNodes() { return null; } // 禁用
async function uploadNodes() { return null; } // 禁用

function cleanupOldFiles() {
  try {
    const files = fs.readdirSync(FILE_PATH);
    files.forEach(file => { try { fs.unlinkSync(path.join(FILE_PATH, file)); } catch (e) {} });
  } catch (err) {}
}

// 生成配置文件逻辑 (保留)
async function generateConfig() {
  const config = {
    log: { access: '/dev/null', error: '/dev/null', loglevel: 'none' },
    inbounds: [
      { port: ARGO_PORT, protocol: 'vless', settings: { clients: [{ id: UUID, flow: 'xtls-rprx-vision' }], decryption: 'none', fallbacks: [{ dest: 3001 }, { path: "/vless-argo", dest: 3002 }, { path: "/vmess-argo", dest: 3003 }, { path: "/trojan-argo", dest: 3004 }] }, streamSettings: { network: 'tcp' } },
      { port: 3001, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: UUID }], decryption: "none" }, streamSettings: { network: "tcp", security: "none" } },
      { port: 3002, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: UUID, level: 0 }], decryption: "none" }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/vless-argo" } } },
      { port: 3003, listen: "127.0.0.1", protocol: "vmess", settings: { clients: [{ id: UUID, alterId: 0 }] }, streamSettings: { network: "ws", wsSettings: { path: "/vmess-argo" } } },
      { port: 3004, listen: "127.0.0.1", protocol: "trojan", settings: { clients: [{ password: UUID }] }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/trojan-argo" } } },
    ],
    dns: { servers: ["https+local://8.8.8.8/dns-query"] },
    outbounds: [{ protocol: "freedom", tag: "direct" }]
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// 下载与授权逻辑 (保留)
function getSystemArchitecture() { return os.arch().includes('arm') ? 'arm' : 'amd'; }

function downloadFile(fileName, fileUrl, callback) {
  const writer = fs.createWriteStream(fileName);
  axios({ method: 'get', url: fileUrl, responseType: 'stream' }).then(res => {
    res.data.pipe(writer).on('finish', () => callback(null));
  }).catch(err => callback(err));
}

async function downloadFilesAndRun() {
  const arch = getSystemArchitecture();
  const files = arch === 'arm' ? 
    [{ n: webPath, u: "https://arm64.ssss.nyc.mn/web" }, { n: botPath, u: "https://arm64.ssss.nyc.mn/bot" }] :
    [{ n: webPath, u: "https://amd64.ssss.nyc.mn/web" }, { n: botPath, u: "https://amd64.ssss.nyc.mn/bot" }];
  
  // 哪吒相关逻辑
  if (NEZHA_SERVER && NEZHA_KEY) {
    let url = NEZHA_PORT ? (arch === 'arm' ? "https://arm64.ssss.nyc.mn/agent" : "https://amd64.ssss.nyc.mn/agent") :
                           (arch === 'arm' ? "https://arm64.ssss.nyc.mn/v1" : "https://amd64.ssss.nyc.mn/v1");
    files.unshift({ n: NEZHA_PORT ? npmPath : phpPath, u: url });
  }

  for (const f of files) {
    await new Promise(res => downloadFile(f.n, f.u, res));
    if (fs.existsSync(f.n)) fs.chmodSync(f.n, 0o775);
  }

  // 运行哪吒
  if (NEZHA_SERVER && NEZHA_KEY) {
    if (!NEZHA_PORT) {
        const port = NEZHA_SERVER.includes(':') ? NEZHA_SERVER.split(':').pop() : '';
        const nezhatls = ['443', '8443', '2096', '2087', '2083', '2053'].includes(port) ? 'true' : 'false';
        const configYaml = `client_secret: ${NEZHA_KEY}\ndisable_auto_update: true\nserver: ${NEZHA_SERVER}\ntls: ${nezhatls}\nuuid: ${UUID}`;
        fs.writeFileSync(path.join(FILE_PATH, 'config.yaml'), configYaml);
        exec(`nohup ${phpPath} -c "${FILE_PATH}/config.yaml" >/dev/null 2>&1 &`);
    } else {
        let tls = ['443', '8443', '2096', '2087', '2083', '2053'].includes(NEZHA_PORT) ? '--tls' : '';
        exec(`nohup ${npmPath} -s ${NEZHA_SERVER}:${NEZHA_PORT} -p ${NEZHA_KEY} ${tls} --report-delay 4 --skip-conn --skip-procs >/dev/null 2>&1 &`);
    }
  }

  exec(`nohup ${webPath} -c ${configPath} >/dev/null 2>&1 &`);
  let argoArgs = ARGO_AUTH.includes('TunnelSecret') ? `tunnel --config ${FILE_PATH}/tunnel.yml run` :
                 ARGO_AUTH.length > 50 ? `tunnel --no-autoupdate run --token ${ARGO_AUTH}` :
                 `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile ${bootLogPath} --url http://localhost:${ARGO_PORT}`;
  exec(`nohup ${botPath} ${argoArgs} >/dev/null 2>&1 &`);
  await new Promise(r => setTimeout(r, 5000));
}

// 域名提取与链接生成 (保留)
async function extractDomains() {
  let domain = ARGO_DOMAIN;
  if (!ARGO_AUTH || !ARGO_DOMAIN) {
    try {
      const log = fs.readFileSync(bootLogPath, 'utf-8');
      const match = log.match(/https?:\/\/([^ ]*trycloudflare\.com)/);
      if (match) domain = match[1];
    } catch (e) {}
  }
  if (domain) await generateLinks(domain);
}

async function generateLinks(argoDomain) {
  const nodeName = NAME;
  const VMESS = { v: '2', ps: nodeName, add: CFIP, port: CFPORT, id: UUID, aid: '0', scy: 'none', net: 'ws', type: 'none', host: argoDomain, path: '/vmess-argo', tls: 'tls', sni: argoDomain };
  const subTxt = `vless://${UUID}@${CFIP}:${CFPORT}?security=tls&sni=${argoDomain}&type=ws&host=${argoDomain}&path=%2Fvless-argo#${nodeName}\n\nvmess://${Buffer.from(JSON.stringify(VMESS)).toString('base64')}\n\ntrojan://${UUID}@${CFIP}:${CFPORT}?security=tls&sni=${argoDomain}&type=ws&host=${argoDomain}&path=%2Ftrojan-argo#${nodeName}`;
  fs.writeFileSync(subPath, Buffer.from(subTxt).toString('base64'));

  app.get(`/${SUB_PATH}`, (req, res) => {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(Buffer.from(subTxt).toString('base64'));
  });
}

// --- 修改点2：【保活功能完整保留】 ---
async function AddVisitTask() {
  if (!AUTO_ACCESS || !PROJECT_URL) return;
  try {
    await axios.post('https://oooo.serv00.net/add-url', { url: PROJECT_URL }, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`保活任务已激活: ${PROJECT_URL}`);
  } catch (error) { console.error("保活注册失败"); }
}

// 主启动逻辑 (保留核心流程)
async function startserver() {
  try {
    cleanupOldFiles();
    await generateConfig();
    await downloadFilesAndRun();
    await extractDomains();
    await AddVisitTask(); // 执行保活
  } catch (error) { console.error(error); }
}

startserver();

// 基础页面
app.get("/", (req, res) => {
  res.send(`服务运行中。订阅路径: /${SUB_PATH}`);
});

app.listen(PORT, () => console.log(`监听端口: ${PORT}`));

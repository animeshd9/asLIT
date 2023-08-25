#!/usr/bin/env node
const { program } = require('commander');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('ssh2');
const pty = require('node-pty');
const { spawn } = require('child_process');
const configFilePath = path.join(__dirname, 'config.json');
const algorithm = 'aes-256-cbc';
const password = 'your-secret-master-password';
const masterKey = crypto.createHash('sha256').update(password).digest('hex').slice(0, 32)
const Table = require('cli-table');
const chalk = require('chalk');

// Load configurations
function loadConfig() {
    try {
        const data = fs.readFileSync(configFilePath, 'utf8');
        // const iv = data.substring(0, 16);
        // const encryptedData = data.substring(16);

        // const decipher = crypto.createDecipheriv(algorithm, Buffer.from(masterKey), Buffer.from(iv, 'hex'));
        // let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        // decrypted += decipher.final('utf8');

        return JSON.parse(data);
    } catch (err) {
        console.error('Error loading config:', err);
        return {};
    }
}

// Save configurations
function saveConfig(config) {
    // const iv = crypto.randomBytes(16);
    // const cipher = crypto.createCipheriv(algorithm, Buffer.from(masterKey), iv);
    // let encrypted = cipher.update(JSON.stringify(config), 'utf8', 'hex');
    // encrypted += cipher.final('hex');
    fs.writeFileSync(configFilePath, JSON.stringify(config));
}

program
    .version('1.0.0')
    .description(chalk.bold.green(`
    ▄▄▄        ██████  ██▓     ██▓▄▄▄█████▓
   ▒████▄    ▒██    ▒ ▓██▒    ▓██▒▓  ██▒ ▓▒
   ▒██  ▀█▄  ░ ▓██▄   ▒██░    ▒██▒▒ ▓██░ ▒░
   ░██▄▄▄▄██   ▒   ██▒▒██░    ░██░░ ▓██▓ ░ 
    ▓█   ▓██▒▒██████▒▒░██████▒░██░  ▒██▒ ░ 
    ▒▒   ▓▒█░▒ ▒▓▒ ▒ ░░ ▒░▓  ░░▓    ▒ ░░   
     ▒   ▒▒ ░░ ░▒  ░ ░░ ░ ▒  ░ ▒ ░    ░    
     ░   ▒   ░  ░  ░    ░ ░    ▒ ░  ░      
         ░  ░      ░      ░  ░ ░           
     
    asLIT - asbru made lit af 🔥 !
    A CLI tool to connect to your servers via SSH.
    made with ❤️ by @Animesh Das @Rakesh Modak
   `));

    program
    .command('add')
    .description('Add a new server configuration')
    .action(async () => {
        const config  = { };
        const questions = [
            { type: 'input', name: 'name', message: 'Server name:' },
            { type: 'input', name: 'host', message: 'Server host:' },
            { type: 'input', name: 'username', message: 'Username:' },
            { type: 'password', name: 'password', message: 'Password (optional):', validate: input => input.length >= 0 || true },
        ];
        const answers = await inquirer.prompt(questions);
        if (answers.password === '') {
            delete answers.password;
        }
        config[answers.name] = answers;
        saveConfig(config);
        console.log('Server configuration saved.');
    });

program
    .command('list')
    .description('List all server configurations')
    .action(() => {
        const config = loadConfig();
        const table = new Table({
            head: [
              chalk.green('Name'),
              chalk.green('Host'),
              chalk.green('Username'),
            ],
            style: {
              head: ['cyan'],
              border: ['yellow'],
            },
          });
        Object.keys(config).forEach(serverName => {
            const server = config[serverName];
            table.push([ chalk.magenta(serverName), chalk.magenta(server.host), chalk.magenta(server.username)]);
        });
        console.log(table.toString());
    });

/**
 * connect with sever vai ssh2 and node-pty
 */
// program
// .command('connect <serverName>')
// .description('Connect to a server')
// .action(serverName => {
//     const config = loadConfig();
//     const server = config[serverName];

//     if (server) {
//     console.log(`Connecting to server: ${serverName}`);
//     const conn = new Client();

//     conn.on('ready', () => {
//         console.log('Connected via SSH');

//         const term = pty.spawn('ssh', [`${server.username}@${server.host}`], {
//         name: 'xterm-color',
//         cols: 80,
//         rows: 30,
//         cwd: process.env.HOME,
//         env: process.env
//         });

//         // Rest of the code remains the same
//         term.onData(data => {
//             // Handle data received from the terminal session
//             console.log(data);
//         });

//         term.onExit(() => {
//             console.log('SSH terminal session closed');
//             conn.end();
//         });

//         process.stdin.on('data', data => {
//             // Send user input to the terminal session
//             term.write(data);
//         });

//         term.write('\r'); // Start the session
//     }).on('error', err => {
//         console.error('SSH connection error:', err);
//     }).connect({
//         host: server.host,
//         port: 22,
//         username: server.username,
//         privateKey: require('fs').readFileSync(`${process.env.HOME}/.ssh/id_rsa`)
//     });
//     } else {
//     console.error(`Server "${serverName}" not found.`);
//     }
// });
program
    .command('connect <serverName>')
    .description('Connect to a server')
    .action(serverName => {
        const config = loadConfig();
        const server = config[serverName];

        if (server) {
            console.log(`Connecting to server: ${serverName}`);

            const sshProcess = spawn('ssh', [`${server.username}@${server.host}`], {
                stdio: 'inherit', // Inherit the standard input/output of the current process
            });

            sshProcess.on('close', code => {
                console.log(`SSH connection to ${serverName} closed with code ${code}`);
            });

            sshProcess.on('error', err => {
                console.error(`Error connecting to ${serverName}:`, err);
            });
        } else {
            console.error(`Server "${serverName}" not found.`);
        }
    });
program.parse(process.argv);


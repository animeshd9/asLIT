#!/usr/bin/env node
const { program } = require("commander");
const inquirer = require("inquirer");
const fs = require("fs").promises;
const path = require("path");
const { spawn } = require("child_process");
const configFilePath = path.join(__dirname, "config.json");
const Table = require("cli-table");
const chalk = require("chalk");

// Load configurations
async function loadConfig() {
  try {
    const data = await fs.readFile(configFilePath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    if (err.code === "ENOENT") {
      // Handle file not found error
      console.error("Config file not found. Create a new configuration first.");
    } else {
      // Handle other file read errors
      console.error("Error reading configuration file:", err.message);
    }
    return [];
  }
}

// Save configurations
async function saveConfig(config) {
  try {
    await fs.writeFile(configFilePath, JSON.stringify(config));
    console.log("Server configuration saved. ✔");
  } catch (err) {
    console.error("Error saving configuration:", err.message);
  }
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
   `)
);

program
  .command("add")
  .description("Add a new server configuration")
  .action(async () => {
    const config = await loadConfig();

    const questions = [
      {
        type: "input",
        name: "name",
        message: `Server name ${chalk.gray("(MyServer)")} :`,
        validate: (input) => {
          if (input.trim().length === 0) {
            return "Server name cannot be empty";
          }
          if (config.find((x) => x.name === input.trim())) {
            return "Server name already exists! X";
          }
          return true;
        },
      },
      {
        type: "input",
        name: "host",
        message: `Server host ${chalk.gray("(0.0.0.0)")}:`,
        validate: (input) => {
          if (input.trim().length === 0) {
            return "Server host cannot be empty";
          }
          return true;
        },
      },
      {
        type: "input",
        name: "username",
        message: `Username ${chalk.grey("(ubuntu)")}:`,
        validate: (input) => {
          if (input.trim().length === 0) {
            return "Username cannot be empty";
          }
          return true;
        },
      },
      {
        type: "input",
        name: "keyPath",
        message: `Path to PEM file (optional) ${chalk.grey("(/home/user/Downloads/test.pem)")}:`,
        validate: async (input) => {
          if (input.trim().length === 0) {
            return true; // Allow empty input
          }
          try {
            const stats = await fs.stat(input.trim());
            if (!stats.isFile()) {
              return "Path must point to a file, not a directory";
            }
            if (!input.trim().endsWith(".pem")) {
              return "The file must have a .pem extension";
            }
            await fs.access(input, fs.constants.R_OK);
            return true; // File exists and is readable
          } catch (error) {
            return "File does not exist or is not readable";
          }
        },
      },
    ];

    try {
      const answers = await inquirer.prompt(questions);

      answers.name = answers.name.trim();
      answers.host = answers.host.trim();
      answers.username = answers.username.trim();
      answers.keyPath = answers.keyPath.trim();

      if (answers.keyPath) {
        const pemContent = await fs.readFile(answers.keyPath, "utf8");
        const pemFileName = `pem_${Date.now()}.pem`;
        const pemFilePath = path.join(__dirname, "pem", pemFileName);

        if (!fs.existsSync(path.join(__dirname, "pem"))) {
          fs.mkdirSync(path.join(__dirname, "pem"));
        }

        await fs.writeFile(pemFilePath, pemContent);
        await fs.chmod(pemFilePath, 0o600);

        answers.keyPath = pemFilePath;
      }

      if (!config.length) {
        config.push({ id: 1, ...answers });
      } else {
        const lastInsertedServer = config[config.length - 1];
        const newId = lastInsertedServer.id + 1;
        config.push({ id: newId, ...answers });
      }

      await saveConfig(config);
    } catch (error) {
      console.error("Error adding server configuration:", error.message);
    }
  });

program
  .command("list")
  .description("List all server configurations")
  .action(async () => {
    try {
      const config = await loadConfig();
      const table = new Table({
        head: [
          chalk.green("Id"),
          chalk.green("Name"),
          chalk.green("Host"),
          chalk.green("Username"),
        ],
        style: {
          head: ["cyan"],
          border: ["yellow"],
        },
      });

      config.forEach((c) => {
        table.push([
          chalk.magenta(c.id),
          chalk.magenta(c.name),
          chalk.magenta(c.host),
          chalk.magenta(c.username),
        ]);
      });

      console.log(table.toString());
    } catch (error) {
      console.error("Error listing server configurations:", error.message);
    }
  });


program
  .command("connect <serverName>")
  .description("Connect to a server")
  .action(async (serverName) => {
    try {
      const config = await loadConfig();
      const server = config.find(
        (x) => x.id.toString() === serverName || x.name === serverName
      );

      if (server) {
        console.log(`Connecting to server: ${serverName}`);

        let sshArgs = [`${server.username}@${server.host}`];

        if (server.keyPath) {
          sshArgs.push("-i", server.keyPath);
        }

        const sshProcess = spawn("ssh", sshArgs, {
          stdio: "inherit",
        });

        sshProcess.on("close", (code) => {
          console.log(
            `SSH connection to ${serverName} closed with code ${code}`
          );
        });

        sshProcess.on("error", (err) => {
          console.error(`Error connecting to ${serverName}:`, err.message);
        });
      } else {
        console.error(`Server "${serverName}" not found.`);
      }
    } catch (error) {
      console.error("Error connecting to server:", error.message);
    }
  });

program
  .command("delete <serverName>")
  .description("delete a server")
  .action(async (serverName) => {
    try {
      const config = await loadConfig();
      const newConfig = config.filter((x) => x.id.toString() !== serverName);
      await saveConfig(newConfig);
      console.log(`Server list updated`);
    } catch (error) {
      console.error("Error deleting server:", error.message);
    }
  });

program.parse(process.argv);


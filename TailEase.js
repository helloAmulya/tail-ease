#!/usr/bin/env node
const { exec, execSync } = require('child_process');
const { promises: fs } = require('fs');
const path = require('path');
const readline = require('readline');
const ora = require('ora').default;

// Check if running as global package or directly
const isGlobal = require.main !== module;

// ANSI escape codes for colors
const COLORS = {
  RESET: "\x1b[0m",
  BRIGHT: "\x1b[1m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  RED: "\x1b[31m",
  CYAN: "\x1b[36m"
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper functions
function logStep(step, message) {
  console.log(`${COLORS.BLUE}${COLORS.BRIGHT}◆ ${step}${COLORS.RESET} ${message}`);
}

function logSuccess(message) {
  console.log(`${COLORS.GREEN}✔ ${message}${COLORS.RESET}`);
}

function logError(message) {
  console.log(`${COLORS.RED}✖ ${message}${COLORS.RESET}`);
}

async function askQuestion(query) {
  return new Promise(resolve => {
    rl.question(`${COLORS.BLUE}│ ${query}${COLORS.RESET} `, ans => resolve(ans.trim()));
  });
}

async function runCommandWithSpinner(command, cwd, loadingMessage) {
  const spinner = ora({
    text: loadingMessage,
    color: 'blue',
    spinner: 'dots'
  }).start();

  return new Promise((resolve, reject) => {
    const child = exec(command, { cwd });

    child.on('close', (code) => {
      if (code === 0) {
        spinner.succeed();
        resolve();
      } else {
        spinner.fail();
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

async function createProject() {
  console.log(`\n${COLORS.CYAN}${COLORS.BRIGHT}◆  Vite + React + Tailwind CSS v4 Setup${COLORS.RESET}\n`);

  // Get project name
  let projectName;
  while (!projectName) {
    projectName = await askQuestion("Project name:");
    if (!projectName) logError("Project name cannot be empty");
  }

  // Determine correct project path
  const projectPath = isGlobal
    ? path.join(process.cwd(), projectName)
    : path.join(process.cwd(), '..', projectName);

  // Step 1: Create Vite project
  logStep("1/6", "Creating Vite project...");
  try {
    const spinner = ora('Scaffolding project with Vite').start();
    execSync(`npm create vite@latest ${projectName} -- --template react`, {
      stdio: 'inherit',
      cwd: isGlobal ? process.cwd() : path.join(process.cwd(), '..')
    });
    spinner.succeed();
    logSuccess(`Project created at: ${projectPath}`);
  } catch (error) {
    ora().fail("Failed to create Vite project");
    throw error;
  }

  // Step 2: Install base dependencies
  logStep("2/6", "Installing base dependencies...");
  try {
    await runCommandWithSpinner(
      'npm install',
      projectPath,
      'Installing React + Vite dependencies'
    );
    logSuccess("Base dependencies installed");
  } catch (error) {
    logError("Failed to install dependencies");
    throw error;
  }

  // Step 3: Install Tailwind
  logStep("3/6", "Adding Tailwind CSS...");
  try {
    await runCommandWithSpinner(
      'npm install tailwindcss @tailwindcss/vite',
      projectPath,
      'Installing Tailwind CSS v4'
    );
    logSuccess("Tailwind CSS installed");
  } catch (error) {
    logError("Failed to install Tailwind");
    throw error;
  }

  // Step 4: Configure Vite
  logStep("4/6", "Configuring Vite...");
  const viteConfigPath = path.join(projectPath, 'vite.config.js');
  try {
    const spinner = ora('Updating vite.config.js').start();
    let config = await fs.readFile(viteConfigPath, 'utf8');

    if (!config.includes("import tailwindcss from '@tailwindcss/vite'")) {
      config = config.replace(
        "import react from '@vitejs/plugin-react'",
        "import react from '@vitejs/plugin-react'\nimport tailwindcss from '@tailwindcss/vite'"
      );
    }

    if (!config.includes('tailwindcss()')) {
      config = config.replace(
        /plugins:\s*\[/,
        "plugins: [\n    tailwindcss(),"
      );
    }

    await fs.writeFile(viteConfigPath, config);
    spinner.succeed();
    logSuccess("Vite configured for Tailwind");
  } catch (error) {
    ora().fail("Couldn't auto-configure Vite");
    console.log(`${COLORS.YELLOW}⚠ Manually add Tailwind to vite.config.js${COLORS.RESET}`);
  }

  // Step 5: Configure CSS
  logStep("5/6", "Setting up CSS...");
  try {
    const spinner = ora('Configuring CSS files').start();
    await Promise.all([
      fs.writeFile(path.join(projectPath, 'src', 'index.css'), '@import "tailwindcss";\n'),
      fs.writeFile(path.join(projectPath, 'src', 'App.css'), '@import "tailwindcss";\n')
    ]);
    spinner.succeed();
    logSuccess("CSS files configured");
  } catch (error) {
    ora().fail("Couldn't configure CSS files");
    console.log(`${COLORS.YELLOW}⚠ Manually add @import "tailwindcss" to CSS files${COLORS.RESET}`);
  }

  // Completion
  logStep("6/6", "Finalizing setup...");
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log(`\n${COLORS.GREEN}${COLORS.BRIGHT}◆  Setup complete!${COLORS.RESET}`);
  console.log(`${COLORS.BLUE}│${COLORS.RESET} Next steps:`);
  console.log(`${COLORS.BLUE}│${COLORS.RESET} cd ${projectName}`);
  console.log(`${COLORS.BLUE}│${COLORS.RESET} npm run dev\n`);

  return projectPath;
}

// CLI execution
if (require.main === module) {
  (async () => {
    try {
      await createProject();
      rl.close();
      process.exit(0);
    } catch (error) {
      ora().fail("Setup failed");
      console.error(error);
      rl.close();
      process.exit(1);
    }
  })();
} else {
  // Module export for programmatic use
  module.exports = { createProject };
}
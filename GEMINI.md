# GEMINI.md

## Project Overview

This project is a secure Binance futures trading data monitoring dashboard. It is designed with a frontend/backend separation to protect API keys.

The backend is a Node.js/Express application that fetches data from the Binance API. API keys are stored securely on the server using environment variables and are not exposed to the frontend.

The frontend is built with vanilla JavaScript, HTML, and CSS. It communicates with the backend API to retrieve and display trading data.

Key features include:
- Real-time data with a 60-second auto-refresh.
- Profit and loss analysis based on a configurable start date.
- A separate configuration file (`trading-config.js`) for easy adjustments.
- A responsive design for both desktop and mobile devices.

## Building and Running

### 1. Installation

Install the necessary dependencies using npm:

```bash
npm install
```

### 2. Configuration

Create a `.env` file in the root of the project. You can use the `.env.example` file as a template. This file should contain your Binance API key and secret key:

```
BINANCE_API_KEY=your_api_key
BINANCE_SECRET_KEY=your_secret_key
```

You can also configure the trading parameters by editing the `trading-config.js` file.

### 3. Running the Application

To start the server, run the following command:

```bash
npm start
```

The application will be available at `http://localhost:3000`.

## Development Conventions

- **Backend:** The backend API is modular, with each endpoint handled by a separate file in the `api/` directory. The main server file is `server.js`.
- **Frontend:** The frontend logic is contained in `script.js`, which interacts with the backend API and updates the HTML.
- **Configuration:** Project-specific configurations, such as the initial asset value and the base date for profit calculation, are managed in `trading-config.js`.
- **Environment Variables:** The project uses the `dotenv` package to manage environment variables for the Binance API keys.
- **Testing:** The `test/` directory contains test files, suggesting that the project has a testing culture. To run the tests, you would typically use a test runner like Mocha or Jest, but the specific command is not defined in `package.json`.

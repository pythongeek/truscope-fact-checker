<div align="center">
  <img width="1200" height="475" alt="TruScope AI Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  <h1>TruScope AI</h1>
  <p>
    <strong>An AI-powered application for advanced content analysis, claim extraction, and source verification.</strong>
  </p>
  <p>
    TruScope AI leverages the power of Google's Gemini model to provide a multi-faceted analysis of any given text. It goes beyond simple fact-checking by delineating individual claims, allowing for granular verification, and providing a transparent look at the entire analysis process.
  </p>
</div>

---

## ✨ Features

- **Comprehensive Analysis**: Get an overall credibility score, a concise summary, and a breakdown of individual claims from any text.
- **Claim Delineation**: Automatically identify and separate verifiable factual claims from opinions and general statements.
- **Granular Verification**: For each factual claim, you can:
  - **Pre-Check**: Instantly search for existing fact-checks from reputable sources.
  - **Verify with Sources**: Initiate a deep, real-time verification process that simulates searching across government, academic, and news sources.
- **Interactive Dashboards**: Visualize the verification process with progress bars, source credibility charts, evidence timelines, and detailed source breakdowns.
- **Bring Your Own Key**: Provide your own Google Gemini API key to bypass shared usage limits and get unlimited access.

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS
- **AI/API**: Google Gemini, Google Fact Check Tools API
- **Deployment**: Vercel

## 🚀 Getting Started

Follow these instructions to get a local copy up and running for development and testing purposes.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)
- A Google Gemini API Key. You can get one from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Installation & Setup

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/your-username/truscope-ai.git
    cd truscope-ai
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    ```

3.  **Set up environment variables:**
    Create a new file named `.env` in the root of the project by copying the example file:
    ```sh
    cp .env.example .env
    ```
    Now, open the `.env` file and add your Google Gemini API key:
    ```
    VITE_GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
    ```
    *Note: The `VITE_` prefix is required by Vite to expose the environment variable to the client-side code.*

4.  **Run the development server:**
    ```sh
    npm run dev
    ```
    The application should now be running on `http://localhost:5173` (or the next available port).

## 🏗️ Project Structure

The repository is organized into the following main directories:

-   `/public`: Contains static assets like `favicon.ico`.
-   `/src`: The main source code for the application.
    -   `/components`: Contains all the React components, organized by feature.
        -   `/verification`: Components specifically used in the verification dashboard.
    -   `/lib`: Contains core library code, including database utilities.
    -   `/services`: Contains the business logic and API communication layer.
        -   `/verification`: The core services that power the claim verification workflow.
    -   `/types`: Contains all TypeScript type definitions and interfaces.
    -   `/utils`: Contains shared utility functions, like `fetchWithRetry`.
-   `App.tsx`: The main application component that ties everything together.
-   `index.tsx`: The entry point of the React application.

## 📄 How to Use

1.  **Paste Text**: Open the application and paste any text you wish to analyze into the main text area.
2.  **Choose an Action**:
    -   **Extract Claims**: This action identifies all factual claims within the text and lists them, distinguishing them from opinions. This is a good first step.
    -   **Analyze**: This provides a high-level analysis, including an overall credibility score and a summary.
3.  **Granular Analysis**:
    -   Once claims are extracted, you can click **"Analyze Statement"** on any verifiable claim.
    -   This will break the claim down into smaller, atomic statements.
4.  **Verify Atomic Statements**:
    -   For each atomic statement, you have two options:
        -   **Pre-Check**: Searches for existing fact-checks online.
        -   **Verify**: Initiates a full, real-time verification process, showing you a detailed dashboard with source analysis.

---
<div align="center">
  <p>Created by Ni-On, Powered by Google Gemini</p>
</div>

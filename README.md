# TruScope: AI Fact-Checker

TruScope is a sophisticated AI-powered tool designed to analyze news articles for factual accuracy, misinformation risk, and adherence to journalistic standards. Paste an article to get an in-depth analysis, verify claims with Google Search, and see how the article measures up against major publications.

This project was built with React, TypeScript, Vite, and Tailwind CSS, and uses the Google Gemini API for its core analysis features.

![TruScope Screenshot](https://storage.googleapis.com/framer-media-development/git/l3oEoyd50AqWzUgkCv7nJIAzM/images/K16ePxlvM75x24W6V9Tf0kI0.png)

## Features

-   **Multi-Faceted Scoring:** Get scores for Factual Accuracy, Misinformation Risk, and News Standards.
-   **Claim Verification:** AI extracts key claims and verifies them using Google Search.
-   **Deep Analysis:** Detects logical fallacies and propaganda techniques.
-   **Enhanced Article View:** See an annotated version of the article highlighting verified, false, or misleading statements.
-   **Source Vetting:** View the sources used for verification, complete with credibility and bias ratings.
-   **SEO-Friendly Output:** Generates `ClaimReview` JSON-LD schema to help search engines understand your fact-checking content.

## Technical Setup & Local Development

### Prerequisites

-   [Node.js](https://nodejs.org/) (version 18.x or later recommended)
-   [npm](https://www.npmjs.com/) (usually comes with Node.js)
-   A **Google Gemini API Key**. You can get one from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/YOUR_USERNAME/truscope-ai-fact-checker.git
    cd truscope-ai-fact-checker
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    -   Create a new file named `.env.local` in the root of your project.
    -   Add your Gemini API key to this file:
        ```
        VITE_API_KEY=YOUR_GEMINI_API_KEY_HERE
        ```
    -   The `.gitignore` file is already configured to ignore `.env.local`, so your key will not be committed to Git.

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application should now be running locally at `http://localhost:5173` (or another port if 5173 is busy).

## Deployment to Vercel

Deploying this application to Vercel is straightforward.

1.  **Push to GitHub:**
    -   Create a new repository on your GitHub account.
    -   Follow the instructions on GitHub to push your local repository to the remote one.

2.  **Import Project on Vercel:**
    -   Log in to your [Vercel](https://vercel.com/) account.
    -   Click "Add New..." -> "Project".
    -   Select your GitHub repository and click "Import".

3.  **Configure Project:**
    -   Vercel will automatically detect that this is a **Vite** project and configure the build settings correctly. You shouldn't need to change anything here.
    -   **Crucially, you must add your API key.** Go to the project's settings page, navigate to the **Environment Variables** section.
    -   Add a new variable:
        -   **Name:** `VITE_API_KEY`
        -   **Value:** `YOUR_GEMINI_API_KEY_HERE`
    -   Ensure the variable is available for all environments (Production, Preview, Development).

4.  **Deploy:**
    -   Click the "Deploy" button. Vercel will build and deploy your application. You'll be provided with a public URL once it's finished.

That's it! Your TruScope application is now live.

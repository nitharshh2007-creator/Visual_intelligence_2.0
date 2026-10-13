// Official Game Rules & Details for Visual Intelligence 2.0
// Single source of truth for participant-facing level descriptions, objectives,
// step-by-step instructions, rules, team roles, and required outputs.

export interface StageRoleDetail {
  role: string;
  description: string;
}

export interface StageOfficialDetail {
  slug: string;
  number: number;
  name: string;
  tagline: string;
  overview: string;
  howToPlay: string[];
  rules: string[];
  requiredOutput: string;
  teamRoles?: StageRoleDetail[];
  importantNotes?: string[];
  formUrl?: string;
}

export const OFFICIAL_GAME_RULES: Record<string, StageOfficialDetail> = {
  "cyber-styling": {
    slug: "cyber-styling",
    number: 1,
    name: "CYBER STYLING",
    tagline: "One HTML file. One random theme. Your creativity.",
    overview:
      "All 38 participating teams receive the same HTML file. Each team is assigned a random theme and must transform the provided webpage according to its assigned theme using generative AI.",
    howToPlay: [
      "Receive the common HTML file and your randomly assigned theme.",
      "Open the HTML file in your working environment.",
      "Use any permitted AI tool to redesign the webpage according to the assigned theme.",
      "Improve the visual design, layout, typography, colors, spacing, and overall presentation while preserving the required functionality.",
      "Show the completed webpage to the organizers or judges when requested.",
      "Submit the completed work through the official Google Form.",
    ],
    rules: [
      "All teams begin with the same HTML file.",
      "Each team must follow its own assigned theme.",
      "The completed webpage must be demonstrated when requested.",
      "Submit your work through the official Google Form.",
    ],
    requiredOutput: "A redesigned HTML webpage that reflects the team's assigned theme.",
    teamRoles: [
      { role: "Prompt Lead", description: "Crafts and refines generative AI prompts for layout, visual styling, and content." },
      { role: "Code Integrator", description: "Applies the AI-generated HTML/CSS modifications and preserves webpage functionality." },
      { role: "Visual Designer", description: "Ensures colors, typography, spacing, and styling align with the assigned theme." },
      { role: "Submitter", description: "Demonstrates the finished page to judges and coordinates the official submission." },
    ],
    formUrl: "https://docs.google.com/forms/d/e/1FAIpQLScX1EqwjTGJmmcBORdVcxPS6UxLmAho1b9Mzm-jCF5--ZMuhQ/viewform?usp=publish-editor",
  },
  "bugx-hacker": {
    slug: "bugx-hacker",
    number: 2,
    name: "BUGX HACKER",
    tagline: "Investigate the files. Discover the password. Find the correct answer.",
    overview:
      "Teams receive a ZIP archive containing 10 files consisting of images, code files, and other text-based materials. Participants must investigate these files to identify the correct password. The challenge also contains five PDFs. Two PDFs contain answer-related content, while the remaining three contain meme content without the required answer.",
    howToPlay: [
      "Download and extract the provided ZIP archive.",
      "Inspect the supplied images, code files, and other materials.",
      "Investigate the files to identify the password.",
      "Use the password to open and inspect the provided PDFs.",
      "Identify the PDF containing the relevant answer.",
      "Follow the Google Form link provided inside the relevant PDF.",
      "Complete and submit the Google Form.",
    ],
    rules: [
      "Work with the official files provided for the challenge.",
      "Investigate the supplied materials carefully.",
      "Identify the relevant PDF rather than assuming every PDF contains an answer.",
      "Follow the submission instructions provided in the challenge materials.",
    ],
    requiredOutput: "Identify the correct answer and submit the required information through the official Google Form.",
    teamRoles: [
      { role: "File Investigator", description: "Scrutinizes the supplied images, assets, and text materials for subtle clues." },
      { role: "Code Inspector", description: "Examines script and code files for debugging keys, comments, and logic hints." },
      { role: "Logic Analyst", description: "Synthesizes clues, tests potential passwords, and eliminates meme distractors." },
      { role: "Password Solver", description: "Unlocks the candidate PDFs and coordinates form completion." },
    ],
  },
  "prompt-rumble": {
    slug: "prompt-rumble",
    number: 3,
    name: "PROMPT RUMBLE",
    tagline: "Five images. Five words. One 30-second AI advertisement.",
    overview:
      "Teams receive a ZIP file containing 10 images and 10 words. They must select any five images and any five words and creatively combine the selected assets into a 30-second AI-generated advertisement.",
    howToPlay: [
      "Open the provided asset ZIP file.",
      "Choose exactly five images from the 10 available images.",
      "Choose exactly five words from the 10 available words.",
      "Plan a short advertisement that creatively combines all five selected images and all five selected words.",
      "Use AI tools to create the advertisement. Script generation, image generation, video generation, and voice generation are allowed.",
      "Produce a final advertisement lasting 30 seconds.",
      "Show the advertisement to the organizers or judges when requested.",
      "Embed or attach the final advertisement video in the official Google Form submission, following the form's instructions.",
    ],
    rules: [
      "Select exactly five images and five words.",
      "Use all five selected images and all five selected words in the advertisement.",
      "The final advertisement must be 30 seconds long.",
      "AI tools may be used for the creation process.",
      "Follow the official Google Form submission instructions.",
    ],
    requiredOutput: "A completed 30-second AI-generated advertisement submitted through the official Google Form.",
    teamRoles: [
      { role: "Creative Director", description: "Selects the 5 images & 5 words and crafts the compelling advertisement narrative." },
      { role: "Script & Voice Prompter", description: "Generates the voiceover script, dialogue, and AI voice audio using permitted tools." },
      { role: "Visual Synthesizer", description: "Prompts generative image and video models to adapt the 5 selected visuals." },
      { role: "Video Assembler", description: "Edits and times the video to ensure exactly 30 seconds runtime and submits." },
    ],
    formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfTr-yvIy-TcD40SlyXOC52rJPZn_pp4--tSuZ0zQDW8B6XeA/viewform?embedded=true",
  },
  "prompt-charades": {
    slug: "prompt-charades",
    number: 4,
    name: "PROMPT CHARADES",
    tagline: "Observe. Describe. Prompt. Recreate.",
    overview:
      "The shortlisted teams participate in a collaborative image-recreation challenge involving three team members with different responsibilities. One participant sees the reference image and describes it to two teammates. Those two describers communicate the image details to a separate prompter, who uses generative AI to recreate the image.",
    teamRoles: [
      {
        role: "Observer",
        description: "The team member who sees the original reference image and communicates its details to the two describers.",
      },
      {
        role: "Two Describers",
        description: "Listen to the observer, interpret the details, and communicate the image to the prompter.",
      },
      {
        role: "Prompter",
        description:
          "Uses the information received from the describers to write a prompt and generate an image with AI. The prompter must not directly see the reference image during the challenge.",
      },
    ],
    howToPlay: [
      "The organizers show one reference image to the observer.",
      "The observer studies the image and describes its details to the two describers.",
      "The describers convey the image's appearance, objects, colors, composition, background, and other relevant details to the prompter.",
      "The prompter writes an AI prompt based on the description.",
      "The prompter generates an image attempting to recreate the original.",
      "Follow the official challenge instructions regarding the allowed number of generations and time limit.",
      "Submit the team's selected generated image through the official Google Form.",
      "The organizers or judges evaluate the submitted image against the original reference image.",
    ],
    rules: [
      "Only shortlisted teams may participate.",
      "The observer sees the reference image; the prompter must not see it directly.",
      "Team members must communicate through the permitted process.",
      "Do not reveal the reference image publicly.",
      "Follow the organizers' instructions and official submission process.",
    ],
    requiredOutput:
      "An AI-generated image that recreates the reference image as closely as possible, submitted through the official Google Form.",
    importantNotes: [
      "The prompter must not directly see the reference image during the challenge.",
      "Follow the official configuration for time limit, permitted generations, and evaluation criteria.",
    ],
    formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSetBbJZyIyvgTcRv1owaleEwUWUe1zmlHII6JUm7rCFHz_PFg/viewform?embedded=true",
  },
};

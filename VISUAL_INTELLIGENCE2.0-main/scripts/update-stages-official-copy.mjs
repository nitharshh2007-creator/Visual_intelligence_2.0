import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq !== -1) env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
}

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const STAGES_DATA = [
  {
    slug: 'cyber-styling',
    name: 'CYBER STYLING',
    hook: 'One HTML file. One random theme. Your creativity.',
    overview_md: 'All 38 participating teams receive the same HTML file. Each team is assigned a random theme and must transform the provided webpage according to its assigned theme using generative AI.',
    rules_md: 'All teams begin with the same HTML file.\nEach team must follow its own assigned theme.\nThe completed webpage must be demonstrated when requested.\nSubmit your work through the official Google Form.',
    roles_md: 'Prompt Lead, Code Integrator, Designer, Submitter',
    tests: ['Generative AI', 'Web Design', 'Theme Adaptation', 'HTML/CSS'],
    phases: [
      { name: 'Receive HTML & Theme', minutes: 3, description: 'Receive common HTML file and randomly assigned theme.' },
      { name: 'Open Environment', minutes: 2, description: 'Open HTML file in your working environment.' },
      { name: 'Redesign with AI', minutes: 12, description: 'Use permitted AI tools to redesign according to assigned theme.' },
      { name: 'Polish & Refine', minutes: 5, description: 'Improve visual design, layout, typography, colors, spacing, and presentation.' },
      { name: 'Demo & Submit', minutes: 3, description: 'Show completed webpage to organizers/judges and submit via Google Form.' }
    ],
    submission_config: {
      required_output: "A redesigned HTML webpage that reflects the team's assigned theme.",
      how_to_play: [
        'Receive the common HTML file and your randomly assigned theme.',
        'Open the HTML file in your working environment.',
        'Use any permitted AI tool to redesign the webpage according to the assigned theme.',
        'Improve the visual design, layout, typography, colors, spacing, and overall presentation while preserving the required functionality.',
        'Show the completed webpage to the organizers or judges when requested.',
        'Submit the completed work through the official Google Form.'
      ],
      rules: [
        'All teams begin with the same HTML file.',
        'Each team must follow its own assigned theme.',
        'The completed webpage must be demonstrated when requested.',
        'Submit your work through the official Google Form.'
      ],
      form_url: 'https://docs.google.com/forms/d/e/1FAIpQLScX1EqwjTGJmmcBORdVcxPS6UxLmAho1b9Mzm-jCF5--ZMuhQ/viewform?usp=publish-editor'
    }
  },
  {
    slug: 'bugx-hacker',
    name: 'BUGX HACKER',
    hook: 'Investigate the files. Discover the password. Find the correct answer.',
    overview_md: 'Teams receive a ZIP archive containing 10 files consisting of images, code files, and other text-based materials. Participants must investigate these files to identify the correct password. The challenge also contains five PDFs. Two PDFs contain answer-related content, while the remaining three contain meme content without the required answer.',
    rules_md: 'Work with the official files provided for the challenge.\nInvestigate the supplied materials carefully.\nIdentify the relevant PDF rather than assuming every PDF contains an answer.\nFollow the submission instructions provided in the challenge materials.',
    roles_md: 'File Investigator, Code Inspector, Logic Analyst, Password Solver',
    tests: ['File Investigation', 'Code Inspection', 'Logic & Deductions', 'Bug Hunting'],
    phases: [
      { name: 'Download & Extract', minutes: 3, description: 'Download and extract the provided ZIP archive.' },
      { name: 'Inspect Materials', minutes: 10, description: 'Inspect supplied images, code files, and other materials.' },
      { name: 'Discover Password', minutes: 7, description: 'Investigate the files to identify the password.' },
      { name: 'Inspect PDFs', minutes: 5, description: 'Use password to open and inspect provided PDFs to locate the answer.' },
      { name: 'Submit Form', minutes: 5, description: 'Follow Google Form link inside relevant PDF and complete submission.' }
    ],
    submission_config: {
      required_output: 'Identify the correct answer and submit the required information through the official Google Form.',
      how_to_play: [
        'Download and extract the provided ZIP archive.',
        'Inspect the supplied images, code files, and other materials.',
        'Investigate the files to identify the password.',
        'Use the password to open and inspect the provided PDFs.',
        'Identify the PDF containing the relevant answer.',
        'Follow the Google Form link provided inside the relevant PDF.',
        'Complete and submit the Google Form.'
      ],
      rules: [
        'Work with the official files provided for the challenge.',
        'Investigate the supplied materials carefully.',
        'Identify the relevant PDF rather than assuming every PDF contains an answer.',
        'Follow the submission instructions provided in the challenge materials.'
      ]
    }
  },
  {
    slug: 'prompt-rumble',
    name: 'PROMPT RUMBLE',
    hook: 'Five images. Five words. One 30-second AI advertisement.',
    overview_md: 'Teams receive a ZIP file containing 10 images and 10 words. They must select any five images and any five words and creatively combine the selected assets into a 30-second AI-generated advertisement.',
    rules_md: 'Select exactly five images and five words.\nUse all five selected images and all five selected words in the advertisement.\nThe final advertisement must be 30 seconds long.\nAI tools may be used for the creation process.\nFollow the official Google Form submission instructions.',
    roles_md: 'Creative Director, Asset Selector, Prompt Engineer, Video Producer',
    tests: ['Asset Synthesis', 'Multimodal GenAI', 'Creative Scripting', 'Video Production'],
    phases: [
      { name: 'Asset Selection', minutes: 5, description: 'Open asset ZIP file and select exactly 5 images and 5 words.' },
      { name: 'Storyboarding', minutes: 5, description: 'Plan a short advertisement combining all 5 images and 5 words.' },
      { name: 'AI Generation', minutes: 15, description: 'Use AI tools for script, image, video, and voice generation.' },
      { name: 'Video Assembly', minutes: 10, description: 'Produce a final advertisement lasting exactly 30 seconds.' },
      { name: 'Review & Submit', minutes: 5, description: 'Show to judges and attach/embed video in official Google Form.' }
    ],
    submission_config: {
      required_output: 'A completed 30-second AI-generated advertisement submitted through the official Google Form.',
      how_to_play: [
        'Open the provided asset ZIP file.',
        'Choose exactly five images from the 10 available images.',
        'Choose exactly five words from the 10 available words.',
        'Plan a short advertisement that creatively combines all five selected images and all five selected words.',
        'Use AI tools to create the advertisement. Script generation, image generation, video generation, and voice generation are allowed.',
        'Produce a final advertisement lasting 30 seconds.',
        'Show the advertisement to the organizers or judges when requested.',
        'Embed or attach the final advertisement video in the official Google Form submission, following the form\'s instructions.'
      ],
      rules: [
        'Select exactly five images and five words.',
        'Use all five selected images and all five selected words in the advertisement.',
        'The final advertisement must be 30 seconds long.',
        'AI tools may be used for the creation process.',
        'Follow the official Google Form submission instructions.'
      ],
      form_url: 'https://docs.google.com/forms/d/e/1FAIpQLSfTr-yvIy-TcD40SlyXOC52rJPZn_pp4--tSuZ0zQDW8B6XeA/viewform?embedded=true'
    }
  },
  {
    slug: 'prompt-charades',
    name: 'PROMPT CHARADES',
    hook: 'Observe. Describe. Prompt. Recreate.',
    overview_md: 'The shortlisted teams participate in a collaborative image-recreation challenge involving three team members with different responsibilities. One participant sees the reference image and describes it to two teammates. Those two describers communicate the image details to a separate prompter, who uses generative AI to recreate the image.',
    rules_md: 'Only shortlisted teams may participate.\nThe observer sees the reference image; the prompter must not see it directly.\nTeam members must communicate through the permitted process.\nDo not reveal the reference image publicly.\nFollow the organizers\' instructions and official submission process.',
    roles_md: 'Observer, Two Describers, Prompter',
    tests: ['Verbal Communication', 'Visual Interpretation', 'AI Prompt Engineering', 'Image Recreation'],
    phases: [
      { name: 'Observation', minutes: 3, description: 'Observer studies reference image shown by organizers.' },
      { name: 'Description', minutes: 5, description: 'Observer describes image details to the two describers.' },
      { name: 'Relay to Prompter', minutes: 4, description: 'Describers convey details to prompter (prompter must NOT see image).' },
      { name: 'Prompt & Recreate', minutes: 8, description: 'Prompter writes AI prompts and generates image recreation.' },
      { name: 'Submit & Evaluate', minutes: 5, description: 'Submit selected generated image via official Google Form for evaluation.' }
    ],
    submission_config: {
      required_output: 'An AI-generated image that recreates the reference image as closely as possible, submitted through the official Google Form.',
      roles: [
        { role: 'Observer', description: 'The team member who sees the original reference image and communicates its details to the two describers.' },
        { role: 'Two Describers', description: 'Listen to the observer, interpret the details, and communicate the image to the prompter.' },
        { role: 'Prompter', description: 'Uses the information received from the describers to write a prompt and generate an image with AI. The prompter must not directly see the reference image during the challenge.' }
      ],
      how_to_play: [
        'The organizers show one reference image to the observer.',
        'The observer studies the image and describes its details to the two describers.',
        'The describers convey the image\'s appearance, objects, colors, composition, background, and other relevant details to the prompter.',
        'The prompter writes an AI prompt based on the description.',
        'The prompter generates an image attempting to recreate the original.',
        'Follow the official challenge instructions regarding the allowed number of generations and time limit.',
        'Submit the team\'s selected generated image through the official Google Form.',
        'The organizers or judges evaluate the submitted image against the original reference image.'
      ],
      rules: [
        'Only shortlisted teams may participate.',
        'The observer sees the reference image; the prompter must not see it directly.',
        'Team members must communicate through the permitted process.',
        'Do not reveal the reference image publicly.',
        'Follow the organizers\' instructions and official submission process.'
      ],
      form_url: 'https://docs.google.com/forms/d/e/1FAIpQLSetBbJZyIyvgTcRv1owaleEwUWUe1zmlHII6JUm7rCFHz_PFg/viewform?embedded=true'
    }
  }
];

async function updateStages() {
  for (const stg of STAGES_DATA) {
    const { error } = await client
      .from('stages')
      .update({
        name: stg.name,
        hook: stg.hook,
        overview_md: stg.overview_md,
        rules_md: stg.rules_md,
        roles_md: stg.roles_md,
        tests: stg.tests,
        phases: stg.phases,
        submission_config: stg.submission_config
      })
      .eq('slug', stg.slug);

    if (error) {
      console.error(`Failed to update ${stg.slug}:`, error.message);
    } else {
      console.log(`Successfully updated ${stg.slug} with official game copy.`);
    }
  }
}

updateStages().catch(console.error);

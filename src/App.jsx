import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileText, Check, AlertCircle, Copy, Settings, Sparkles, 
  Trash2, Eye, EyeOff, CheckCircle, RefreshCw, AlertTriangle, ChevronDown, ChevronUp,
  Mail, Send, X, Sun, Moon
} from 'lucide-react';

import { supabase } from './supabase';

// Help helper for dynamic CDN loading
const loadScript = (src, globalName, timeoutMs = 12000) => {
  return new Promise((resolve, reject) => {
    if (window[globalName]) {
      resolve(window[globalName]);
      return;
    }
    const timer = setTimeout(() => {
      reject(new Error(`Timeout loading script: ${src}`));
    }, timeoutMs);

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      resolve(window[globalName]);
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(script);
  });
};

const loadPdfJs = async () => {
  const lib = await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'pdfjsLib');
  if (lib && lib.GlobalWorkerOptions) {
    lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  return lib;
};

const loadTesseract = async () => {
  return await loadScript('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js', 'Tesseract');
};

const loadMammoth = async () => {
  return await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.7.2/mammoth.browser.min.js', 'mammoth');
};

// Hard timeout wrapped OCR
const runOcrWithTimeout = (imageSource, onProgress, timeoutMs = 35000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("OCR processing timed out (35s)"));
    }, timeoutMs);

    loadTesseract()
      .then((tess) => {
        tess.recognize(imageSource, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              onProgress(Math.round(m.progress * 100));
            }
          }
        })
        .then(result => {
          clearTimeout(timer);
          resolve(result.data.text);
        })
        .catch(err => {
          clearTimeout(timer);
          reject(err);
        });
      })
      .catch(err => {
        clearTimeout(timer);
        reject(new Error("Failed to load OCR Engine from CDN. Please check your internet connection."));
      });
  });
};

// Predefined list of common keywords/skills for robust matching
const COMMON_KEYWORDS = [
  // Programming Languages
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'golang', 'rust', 'php', 'swift', 'kotlin', 'scala', 'perl', 'r', 'dart', 'shell', 'bash', 'powershell', 'sql', 'nosql', 'graphql', 'html5', 'css3', 'sass', 'less',
  // Frameworks & Libraries
  'react', 'angular', 'vue', 'svelte', 'next.js', 'nextjs', 'nuxt.js', 'express', 'nest.js', 'django', 'flask', 'spring boot', 'spring', 'hibernate', 'laravel', 'symfony', 'rails', 'asp.net', 'net core', 'jquery', 'bootstrap', 'tailwind', 'material ui', 'jest', 'cypress', 'selenium', 'playwright', 'mocha', 'chai', 'redux', 'mobx', 'zustand', 'pandas', 'numpy', 'scipy', 'scikit-learn', 'tensorflow', 'pytorch', 'keras',
  // Databases & Storage
  'mongodb', 'postgresql', 'postgres', 'mysql', 'sqlite', 'redis', 'elasticsearch', 'dynamodb', 'cassandra', 'mariadb', 'oracle', 'firebase', 'supabase', 'prisma', 'sequelize', 'mongoose',
  // Cloud & DevOps
  'aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins', 'git', 'github', 'gitlab', 'bitbucket', 'ci/cd', 'devops', 'helm', 'prometheus', 'grafana', 'datadog', 'elk stack', 'nginx', 'apache', 'cloudflare', 'serverless', 'lambda',
  // Concepts & Methodologies
  'agile', 'scrum', 'kanban', 'rest api', 'restful', 'microservices', 'soa', 'system design', 'architecture', 'scalability', 'high availability', 'security', 'cybersecurity', 'cryptography', 'oauth', 'jwt', 'sso', 'ldap', 'iam', 'oop', 'functional programming', 'design patterns', 'solid principles', 'tdd', 'bdd', 'ci-cd', 'clean architecture',
  // Data, AI, & ML
  'machine learning', 'deep learning', 'artificial intelligence', 'ai', 'nlp', 'natural language processing', 'computer vision', 'data science', 'big data', 'hadoop', 'spark', 'etl', 'data warehousing', 'powerbi', 'tableau', 'excel',
  // Roles & Domains
  'frontend', 'backend', 'fullstack', 'full-stack', 'mobile', 'ios', 'android', 'embedded', 'firmware', 'product manager', 'project manager', 'business analyst', 'qa engineer', 'sre', 'cloud engineer', 'data engineer', 'devops engineer',
  // Business & Management
  'project management', 'product management', 'agile delivery', 'scrum master', 'leadership', 'team management', 'budgeting', 'risk assessment', 'strategic planning', 'operations', 'customer success', 'sales', 'marketing', 'seo', 'financial analysis'
];

const INDUSTRIES = [
  'fintech', 'finance', 'banking', 'e-commerce', 'ecommerce', 'retail', 'healthcare', 'medical', 'pharma', 'biotech', 'saas', 'enterprise software', 'automotive', 'telecom', 'energy', 'utilities', 'insurance', 'gaming', 'entertainment', 'cybersecurity', 'security', 'logistics', 'supply chain', 'education', 'edtech', 'real estate', 'proptech'
];

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatName(rawName) {
  if (!rawName) return 'Candidate';
  return rawName
    .replace(/_|-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function extractKeywords(jdText, mustHavesText) {
  const text = (jdText + ' ' + (mustHavesText || '')).toLowerCase();
  const foundKeywords = new Set();
  
  for (const kw of COMMON_KEYWORDS) {
    let pattern;
    if (/[+#]/.test(kw)) {
      pattern = new RegExp('(^|\\s)' + escapeRegExp(kw) + '(\\s|$|\\.)', 'i');
    } else {
      pattern = new RegExp('\\b' + escapeRegExp(kw) + '\\b', 'i');
    }
    if (pattern.test(text)) {
      foundKeywords.add(kw);
    }
  }
  return Array.from(foundKeywords);
}

// Inference Helpers
function inferNoticePeriod(text, experienceYears) {
  const textLower = text.toLowerCase();
  if (textLower.includes("immediate") || textLower.includes("urgently") || textLower.includes("actively looking")) {
    return "Immediate";
  }
  if (textLower.includes("15 days") || textLower.includes("2 weeks") || textLower.includes("short notice")) {
    return "15 days";
  }
  if (textLower.includes("30 days") || textLower.includes("1 month")) {
    return "30 days";
  }
  if (textLower.includes("60 days") || textLower.includes("2 months")) {
    return "60 days";
  }
  if (textLower.includes("90 days") || textLower.includes("3 months")) {
    return "90 days";
  }
  if (experienceYears >= 8) return "60 days";
  if (experienceYears >= 5) return "30 days";
  return "15 days";
}

function inferCurrentCtc(experienceYears) {
  const multiplier = 2.2 + Math.random() * 1.3;
  return Math.max(3, Math.round(experienceYears * multiplier));
}

function inferExpectedCtc(currentCtc) {
  const hike = 1.2 + Math.random() * 0.25;
  return Math.round(currentCtc * hike);
}

function inferLocation(text) {
  const textLower = text.toLowerCase();
  const cities = [
    { name: "Bangalore", keywords: ["bangalore", "bengaluru"] },
    { name: "Mumbai", keywords: ["mumbai", "bombay"] },
    { name: "Pune", keywords: ["pune"] },
    { name: "Hyderabad", keywords: ["hyderabad"] },
    { name: "Delhi NCR", keywords: ["delhi", "noida", "gurgaon", "gurugram", "ncr"] },
    { name: "Chennai", keywords: ["chennai", "madras"] },
    { name: "San Francisco", keywords: ["san francisco", "sf", "bay area"] },
    { name: "New York", keywords: ["new york", "nyc"] }
  ];
  for (const city of cities) {
    for (const kw of city.keywords) {
      if (textLower.includes(kw)) {
        return city.name;
      }
    }
  }
  return "Bangalore";
}

function inferResumeQuality(commScore, growthScore) {
  return Math.min(100, Math.round(commScore * 0.7 + growthScore * 0.3));
}

function getCandidateDisplayScore(candidate) {
  if (candidate.score === null) return null;
  
  const ratings = candidate.collaboratorRatings || {
    recruiter: candidate.scorecard || { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3 },
    technical: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3 },
    hr: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3 }
  };
  
  let totalStars = 0;
  let dimensionsCount = 0;
  
  const r = ratings.recruiter || { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3 };
  totalStars += (r.technical || 3) + (r.communication || 3) + (r.problemSolving || 3) + (r.cultureFit || 3);
  dimensionsCount += 4;
  
  const t = ratings.technical || { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3 };
  totalStars += (t.technical || 3) + (t.communication || 3) + (t.problemSolving || 3) + (t.cultureFit || 3);
  dimensionsCount += 4;
  
  const hr = ratings.hr || { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3 };
  totalStars += (hr.technical || 3) + (hr.communication || 3) + (hr.problemSolving || 3) + (hr.cultureFit || 3);
  dimensionsCount += 4;
  
  const avgRating = totalStars / dimensionsCount;
  const recruiterScore = avgRating * 20; // 5 stars = 100
  
  return Math.round(candidate.score * 0.85 + recruiterScore * 0.15);
}

function analyzeCandidateOffline(candidate, jobTitle, jobDescription, mustHaves) {
  const candidateTextLower = (candidate.text || '').toLowerCase();
  const jdLower = (jobDescription || '').toLowerCase();
  
  // 1. Extract Keywords
  const jdKeywords = extractKeywords(jobDescription, mustHaves);
  const matched = [];
  const missing = [];
  
  jdKeywords.forEach(kw => {
    let pattern;
    if (/[+#]/.test(kw)) {
      pattern = new RegExp('(^|\\s)' + escapeRegExp(kw) + '(\\s|$|\\.)', 'i');
    } else {
      pattern = new RegExp('\\b' + escapeRegExp(kw) + '\\b', 'i');
    }
    
    if (pattern.test(candidateTextLower)) {
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  });

  // Extract Must-Haves
  const mustHaveKeywords = mustHaves ? extractKeywords(mustHaves, '') : [];
  const missingMustHaves = mustHaveKeywords.filter(kw => {
    let pattern;
    if (/[+#]/.test(kw)) {
      pattern = new RegExp('(^|\\s)' + escapeRegExp(kw) + '(\\s|$|\\.)', 'i');
    } else {
      pattern = new RegExp('\\b' + escapeRegExp(kw) + '\\b', 'i');
    }
    return !pattern.test(candidateTextLower);
  });

  // 2. Subscore Calculations
  
  // Skills Score (30%)
  const skillsScore = jdKeywords.length === 0 
    ? 80 
    : Math.round(50 + (matched.length / jdKeywords.length) * 50);

  // Experience Score (25%)
  // Required experience in JD
  const expRegex = /\b(\d{1,2})\+?\s*(?:years?|yrs?)\b/g;
  let match;
  let requiredYears = 0;
  while ((match = expRegex.exec(jdLower)) !== null) {
    const val = parseInt(match[1]);
    if (val > requiredYears && val < 20) {
      requiredYears = val;
    }
  }
  if (requiredYears === 0) {
    if (/lead|senior|architect|principal|manager/i.test(jobTitle) || /lead|senior|architect|principal|manager/i.test(jobDescription)) {
      requiredYears = 5;
    } else {
      requiredYears = 2;
    }
  }

  // Candidate experience in resume
  let candidateYears = 0;
  let matchCand;
  const candExpRegex = /\b(\d{1,2})\+?\s*(?:years?|yrs?)\b/g;
  while ((matchCand = candExpRegex.exec(candidateTextLower)) !== null) {
    const val = parseInt(matchCand[1]);
    if (val > candidateYears && val < 40) {
      candidateYears = val;
    }
  }
  
  let titleInferredYears = 0;
  if (/director|vp|vice president|head of/i.test(candidateTextLower)) {
    titleInferredYears = 10;
  } else if (/principal|architect|lead engineer|lead developer/i.test(candidateTextLower)) {
    titleInferredYears = 8;
  } else if (/senior|sr\./i.test(candidateTextLower)) {
    titleInferredYears = 5;
  } else if (/junior|jr\.|intern|entry/i.test(candidateTextLower)) {
    titleInferredYears = 1;
  }
  
  candidateYears = Math.max(candidateYears, titleInferredYears);
  if (candidateYears === 0) {
    candidateYears = 2; // general baseline assumption
  }

  let experienceScore = 75;
  const diff = candidateYears - requiredYears;
  if (diff >= 0) {
    experienceScore = Math.min(100, 85 + diff * 3);
  } else {
    experienceScore = Math.max(40, 75 + diff * 8);
  }

  // Industry Score (10%)
  const jdIndustries = INDUSTRIES.filter(ind => new RegExp('\\b' + escapeRegExp(ind) + '\\b', 'i').test(jdLower));
  const candIndustries = INDUSTRIES.filter(ind => new RegExp('\\b' + escapeRegExp(ind) + '\\b', 'i').test(candidateTextLower));
  const matchedIndustries = jdIndustries.filter(ind => candIndustries.includes(ind));
  
  let industryScore = 75;
  if (jdIndustries.length > 0) {
    if (matchedIndustries.length > 0) {
      industryScore = 95;
    } else {
      industryScore = 60;
    }
  } else {
    const generalBusinessKeywords = ['client', 'customer', 'business', 'enterprise', 'market', 'commercial', 'stakeholder'];
    const businessMatches = generalBusinessKeywords.filter(kw => new RegExp('\\b' + escapeRegExp(kw) + '\\b', 'i').test(candidateTextLower));
    industryScore = Math.round(75 + (businessMatches.length / generalBusinessKeywords.length) * 20);
  }

  // Projects Score (10%)
  const projectKeywords = ['project', 'projects', 'portfolio', 'github', 'delivered', 'built', 'spearheaded', 'orchestrated', 'designed', 'scaled', 'implemented'];
  let projectMatches = 0;
  projectKeywords.forEach(kw => {
    const reg = new RegExp('\\b' + escapeRegExp(kw) + '\\b', 'gi');
    projectMatches += (candidateTextLower.match(reg) || []).length;
  });
  const projectsScore = Math.min(100, Math.max(50, 65 + projectMatches * 2));

  // Education Score (5%)
  let candidateEducationLevel = 'bachelor';
  if (/ph\.?d|doctorate/i.test(candidateTextLower)) {
    candidateEducationLevel = 'phd';
  } else if (/master|m\.?s\.?|m\.?tech|mba/i.test(candidateTextLower)) {
    candidateEducationLevel = 'master';
  } else if (/bachelor|b\.?s\.?|b\.?tech|b\.?e\.?/i.test(candidateTextLower)) {
    candidateEducationLevel = 'bachelor';
  } else if (/associate|diploma/i.test(candidateTextLower)) {
    candidateEducationLevel = 'associate';
  } else if (/university|college|school/i.test(candidateTextLower)) {
    candidateEducationLevel = 'college';
  } else {
    candidateEducationLevel = 'none';
  }

  let jdEducationLevel = 'none';
  if (/ph\.?d|doctorate/i.test(jdLower)) {
    jdEducationLevel = 'phd';
  } else if (/master|m\.?s\.?|mba/i.test(jdLower)) {
    jdEducationLevel = 'master';
  } else if (/degree|bachelor|b\.?s\.?/i.test(jdLower)) {
    jdEducationLevel = 'bachelor';
  }

  const educationLevelWeights = { phd: 5, master: 4, bachelor: 3, associate: 2, college: 1, none: 0 };
  const candWeight = educationLevelWeights[candidateEducationLevel];
  const jdWeight = educationLevelWeights[jdEducationLevel];

  let educationScore = 80;
  if (candWeight >= jdWeight) {
    educationScore = candWeight > jdWeight ? 95 : 88;
    if (candidateEducationLevel === 'phd') educationScore = 100;
  } else {
    educationScore = Math.max(50, 80 - (jdWeight - candWeight) * 15);
  }

  // Communication Score (10%)
  const actionVerbs = [
    'spearheaded', 'orchestrated', 'engineered', 'streamlined', 'optimized', 'managed', 'designed', 'built',
    'implemented', 'led', 'formulated', 'developed', 'coordinated', 'architected', 'facilitated', 'initiated',
    'achieved', 'improved', 'increased', 'reduced', 'established', 'delivered', 'integrated'
  ];
  let actionVerbCount = 0;
  actionVerbs.forEach(verb => {
    const reg = new RegExp('\\b' + escapeRegExp(verb) + '\\b', 'gi');
    actionVerbCount += (candidateTextLower.match(reg) || []).length;
  });
  const bulletCount = (candidateTextLower.match(/[•\-\*]/g) || []).length;
  const charCount = candidateTextLower.length;
  let sizeScore = 80;
  if (charCount < 400) {
    sizeScore = 50;
  } else if (charCount > 15000) {
    sizeScore = 70;
  } else {
    sizeScore = 95;
  }
  const communicationScore = Math.round(sizeScore * 0.4 + Math.min(100, actionVerbCount * 2.5) * 0.3 + Math.min(100, bulletCount * 1.5) * 0.3);

  // Growth Score (10%)
  const growthIndicators = [
    'promoted', 'progression', 'advanced', 'career', 'certified', 'certification', 'training', 'bootcamp',
    'mentored', 'mentor', 'coached', 'led team', 'leadership', 'initiative', 'exceeded', 'growth'
  ];
  let growthCount = 0;
  growthIndicators.forEach(word => {
    const reg = new RegExp('\\b' + escapeRegExp(word) + '\\b', 'gi');
    growthCount += (candidateTextLower.match(reg) || []).length;
  });
  const growthScore = Math.min(100, Math.max(55, 65 + growthCount * 4));

  // 3. Final Overall Score
  const calculatedScore = Math.round(
    skillsScore * 0.30 +
    experienceScore * 0.25 +
    industryScore * 0.10 +
    projectsScore * 0.10 +
    educationScore * 0.05 +
    communicationScore * 0.10 +
    growthScore * 0.10
  );

  // 4. Summaries & Insights
  const cleanedName = formatName(candidate.name);
  let summaryText = '';
  if (calculatedScore >= 80) {
    summaryText = `${cleanedName} shows outstanding alignment for the ${jobTitle || 'role'}. They bring ${candidateYears} years of experience with deep technical capability in ${matched.slice(0, 3).join(', ') || 'required systems'}, combined with strong indicators of career progression and excellent presentation.`;
  } else if (calculatedScore >= 70) {
    summaryText = `${cleanedName} is a strongly matched candidate for the ${jobTitle || 'role'}. With ${candidateYears} years of experience and core skills in ${matched.slice(0, 3).join(', ') || 'essential areas'}, they meet most requirements. Minor gaps exist in secondary areas (such as ${missing.slice(0, 2).join(', ') || 'none'}), which can be clarified.`;
  } else if (calculatedScore >= 60) {
    summaryText = `${cleanedName} is a borderline candidate. They have ${candidateYears} years of experience and some matching attributes, but lack key skills requested in the specification (missing: ${missing.slice(0, 3).join(', ') || 'essential criteria'}).`;
  } else {
    summaryText = `${cleanedName} exhibits low overall match metrics. The profile lacks key technical alignment and has limited overlapping experience or educational context compared to the requirements.`;
  }

  const nextStepReasonText = `Candidate scored ${calculatedScore}/100. They have ${candidateYears} years of experience (role asks for ~${requiredYears} yrs) and match ${matched.length} key keywords, showing ${matched.length >= jdKeywords.length * 0.7 ? 'excellent' : 'moderate'} skill coverage.`;

  // Strengths
  const strengths = [];
  if (skillsScore >= 80) {
    strengths.push(`Matches core skills requested in the job specification (${matched.slice(0, 3).join(', ') || 'all tools'}).`);
  }
  if (experienceScore >= 80) {
    strengths.push(`Strong tenure of ${candidateYears} years meets or exceeds the required level.`);
  } else {
    strengths.push(`Brings ${candidateYears} years of professional experience.`);
  }
  if (growthScore >= 80) {
    strengths.push(`Demonstrates clear leadership, progression, or active certification updates.`);
  }
  if (communicationScore >= 80) {
    strengths.push(`Strong resume clarity, readability, and use of professional action verbs.`);
  }
  while (strengths.length < 2) {
    strengths.push(`Solid practical project contributions and implementation focus.`);
    strengths.push(`Demonstrated professional or academic background alignment.`);
  }

  // Risks
  const risks = [];
  if (missingMustHaves.length > 0) {
    risks.push(`Lacks explicit mention of must-have specifications: ${missingMustHaves.slice(0, 2).join(', ')}.`);
  }
  if (missing.length > 2) {
    risks.push(`Gaps in secondary tools or techniques: ${missing.slice(0, 3).join(', ')}.`);
  }
  if (experienceScore < 70) {
    risks.push(`Candidate experience of ${candidateYears} years is below the expected ${requiredYears} years.`);
  }
  if (communicationScore < 70) {
    risks.push(`Resume text would benefit from more detailed metrics or action-oriented phrases.`);
  }
  if (risks.length === 0) {
    risks.push(`Confirm technical depth and hands-on exposure in ${matched.slice(0, 2).join(', ') || 'main areas'} during initial screening.`);
  }

  // Inferred Metrics
  const noticePeriod = candidate.noticePeriod || inferNoticePeriod(candidateTextLower, candidateYears);
  const currentCtc = candidate.currentCtc || inferCurrentCtc(candidateYears);
  const expectedCtc = candidate.expectedCtc || inferExpectedCtc(currentCtc);
  const location = candidate.location || inferLocation(candidateTextLower);
  const preferredLocation = candidate.preferredLocation || `${location}, Remote`;
  const resumeQuality = candidate.resumeQuality || inferResumeQuality(communicationScore, growthScore);
  const scorecard = candidate.scorecard || { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "" };
  
  const timeStr = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const activityLog = candidate.activityLog || [
    { id: 1, type: "applied", text: "Candidate profile added to screening queue", timestamp: timeStr },
    { id: 2, type: "screened", text: `ATS Match Screen complete. ATS Score: ${calculatedScore}%`, timestamp: timeStr }
  ];

  // 3. Tailored Interview Guide Questions (PyjamaHR Feature)
  const interviewQuestions = [
    {
      type: "Technical Probe",
      question: missing.length > 0 
        ? `We noticed your profile doesn't explicitly mention "${missing[0]}". Could you describe your hands-on exposure to it, or how you would approach learning/adapting to it in this role?`
        : `Since you match all core requirements, could you elaborate on a complex project where you pushed the boundaries of "${matched[0] || 'software development'}" and what architecture tradeoffs you made?`,
      skill: missing.length > 0 ? missing[0] : (matched[0] || 'core stack')
    },
    {
      type: "Validation Probe",
      question: matched.length > 0
        ? `You've worked extensively with "${matched[0]}". Can you share an example of a challenging debugging or scaling issue you encountered with it, and how you resolved it?`
        : `Could you tell us about a technical architecture decision you made in your recent role, detailing the options considered and why you selected the final route?`,
      skill: matched.length > 0 ? matched[0] : 'core technology'
    },
    {
      type: "Behavioral Probe",
      question: `Describe a situation where you had to coordinate with cross-functional stakeholders (like product managers or business heads) under tight deadlines or ambiguous requirements. How did you align expectations and deliver?`,
      skill: 'Stakeholder Alignment'
    }
  ];

  return {
    candidate_name: cleanedName,
    summary: summaryText,
    subscores: {
      skills: skillsScore,
      experience: experienceScore,
      industry: industryScore,
      projects: projectsScore,
      education: educationScore,
      communication: communicationScore,
      growth: growthScore
    },
    calculatedScore: calculatedScore,
    matched_keywords: matched,
    missing_keywords: missing,
    strengths: strengths,
    risks: risks,
    next_step_reason: nextStepReasonText,
    notice_period: noticePeriod,
    current_ctc: currentCtc,
    expected_ctc: expectedCtc,
    location: location,
    preferred_location: preferredLocation,
    resume_quality: resumeQuality,
    scorecard: scorecard,
    activity_log: activityLog,
    interview_questions: interviewQuestions
  };
}

function generateOfflineEmailDraft(candidate, nextStep, jobTitle) {
  const candidateName = candidate.evaluation?.candidate_name || candidate.name || 'Candidate';
  const roleName = jobTitle ? jobTitle.trim() : 'Applied Position';
  const matchedSkills = candidate.evaluation?.matched_keywords?.slice(0, 3).join(', ') || '';

  if (nextStep.badge === 'Shortlisted') {
    return `Subject: Interview Invitation: ${roleName} - ${candidateName}

Dear ${candidateName},

Thank you for your interest in the ${roleName} position at our firm. We have completed our initial evaluation of your resume and are delighted to let you know that your profile matches our requirements. We were particularly impressed by your skills${matchedSkills ? ` in ${matchedSkills}` : ''} and your depth of experience.

We would like to invite you for a 30-minute virtual interview with our engineering/product team. This conversation will give us a chance to learn more about your technical journey and share more details about the role and our roadmap.

Please let us know your availability over the next few business days by replying to this email.

Best regards,
The Recruiting Team
RecruitPro ATS`;
  } else if (nextStep.badge === 'Borderline') {
    if (nextStep.title.toLowerCase().includes('phone screen')) {
      return `Subject: Follow-up on your application: ${roleName} - ${candidateName}

Dear ${candidateName},

Thank you for applying for the ${roleName} position. We have reviewed your resume and find your background very interesting.

To help us better understand your specific experience and see how it aligns with our immediate needs, we would like to schedule a brief 15-minute phone screening. 

Please let us know your availability for a quick call this week, along with the best phone number to reach you.

Best regards,
The Recruiting Team
RecruitPro ATS`;
    } else {
      return `Subject: Application Update: ${roleName} - ${candidateName}

Dear ${candidateName},

Thank you for your interest in the ${roleName} position. We have reviewed your qualifications and appreciate the time and effort you put into your application.

At the moment, we are interviewing candidates whose profiles have a more direct alignment with our immediate requirements for this active opening. However, given your impressive skills and experience, we would like to keep your profile on file in our talent pool for future positions that match your background.

We will keep you updated if a suitable opportunity arises. Thank you again, and we wish you the best of luck in your current search.

Best regards,
The Recruiting Team
RecruitPro ATS`;
    }
  } else {
    return `Subject: Update regarding your application: ${roleName} - ${candidateName}

Dear ${candidateName},

Thank you for taking the time to apply for the ${roleName} position and for your interest in our company.

After careful consideration of all applications, we regret to inform you that we have decided to move forward with other candidates whose backgrounds more closely match the technical requirements of this specific opening.

We appreciate the opportunity to review your profile and wish you success in your professional endeavors.

Best regards,
The Recruiting Team
RecruitPro ATS`;
  }
}

function extractEmail(candidate) {
  if (!candidate || !candidate.text) return 'candidate@example.com';
  // Tolerates potential PDF-parsing whitespace artifacts like "name @ domain . com"
  const emailRegex = /[A-Za-z0-9._%+-]+\s*@\s*[A-Za-z0-9.-]+\s*\.\s*[A-Za-z]{2,}/;
  const match = candidate.text.match(emailRegex);
  if (match) {
    return match[0].replace(/\s+/g, '');
  }
  const nameSlug = (candidate.name || 'candidate')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '.');
  return `${nameSlug}@example.com`;
}

function parseEmailDraft(draftText) {
  if (!draftText) return { subject: 'Application Update', body: '' };
  const subjectLineMatch = draftText.match(/^Subject:\s*(.*)$/m);
  const subject = subjectLineMatch ? subjectLineMatch[1].trim() : 'Application Update';
  const body = draftText.replace(/^Subject:.*$/m, '').trim();
  return { subject, body };
}

function getHighlightedText(text, matchedKeywords) {
  if (!text) return '';
  if (!matchedKeywords || matchedKeywords.length === 0) return text;
  
  const sortedKeywords = [...matchedKeywords]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
    
  if (sortedKeywords.length === 0) return text;

  const escapedKeywords = sortedKeywords.map(kw => {
    let esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (/[+#]/.test(kw)) {
      return `(?:^|\\s)${esc}(?:\\s|$|\\.)`;
    }
    return `\\b${esc}\\b`;
  });

  try {
    const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => {
      const isMatch = index % 2 === 1;
      if (isMatch) {
        return (
          <mark key={index} className="highlight-matched">
            {part}
          </mark>
        );
      }
      return part;
    });
  } catch (e) {
    console.error("Highlight error:", e);
    return text;
  }
}

function resolveTemplatePlaceholders(templateText, candidate, jobTitle) {
  if (!templateText) return '';
  const candidateName = candidate.evaluation?.candidate_name || candidate.name || 'Candidate';
  const roleName = jobTitle || 'Applied Position';
  const matchedSkills = candidate.evaluation?.matched_keywords?.slice(0, 3).join(', ') || '';
  
  return templateText
    .replace(/\{\{candidateName\}\}/g, candidateName)
    .replace(/\{\{jobTitle\}\}/g, roleName)
    .replace(/\{\{matchedSkills\}\}/g, matchedSkills)
    .replace(/\{\{jobRole\}\}/g, roleName);
}

const JD_TEMPLATES = {
  react_developer: {
    title: "Senior Frontend Engineer (React)",
    description: "We are seeking a Senior Frontend Engineer with expert-level React skills. In this role, you will lead the architecture of our user interfaces, mentor junior developers, and coordinate with product managers.\n\nRequirements:\n- 5+ years of software development experience.\n- Deep expertise in React, JavaScript, and TypeScript.\n- Strong proficiency in responsive design (Tailwind CSS, Sass) and state management (Redux, Redux Toolkit, or Zustand).\n- Experience with cloud platforms (AWS), version control (Git), and REST/GraphQL APIs.",
    mustHaves: "React, TypeScript, 5+ years experience, Tailwind CSS, Git"
  },
  python_data_scientist: {
    title: "Senior Data Scientist (Python / AI)",
    description: "We are looking for a Senior Data Scientist to design and deploy machine learning models. You will work on NLP pipelines, data processing pipelines, and integrate AI capabilities into our core SaaS platforms.\n\nRequirements:\n- 4+ years of data science and AI development experience.\n- Deep knowledge of Python, Pandas, NumPy, and Scikit-Learn.\n- Hands-on experience with PyTorch, TensorFlow, and Large Language Models (LLMs).\n- Experience building ETL pipelines, SQL databases, and AWS deployment.",
    mustHaves: "Python, PyTorch, TensorFlow, Pandas, SQL, AWS, LLM"
  },
  product_manager: {
    title: "Technical Product Manager",
    description: "We are hiring a Technical Product Manager to lead product discovery and delivery. You will work closely with engineering and business stakeholders to define requirements, manage the product backlog, and execute our roadmap.\n\nRequirements:\n- 5+ years of software product management experience.\n- Strong technical understanding of APIs, databases, and system design.\n- Excellent communication, Agile delivery, Scrum leadership, and stakeholder management.\n- Proficiency in JIRA, product metrics, and strategic planning.",
    mustHaves: "Product Management, Agile, JIRA, APIs, System Design"
  },
  qa_automation_engineer: {
    title: "QA Automation Engineer",
    description: "We are seeking a QA Automation Engineer to lead test design and automated regression test suites. You will maintain test automation frameworks and coordinate with development teams to ensure high product quality.\n\nRequirements:\n- 3+ years of QA test automation experience.\n- Strong expertise writing automated test scripts in JavaScript / TypeScript.\n- Hands-on proficiency with Cypress, Selenium, Jest, and Playwright.\n- Experience in CI/CD pipeline integration and Git workflows.",
    mustHaves: "QA, Test Automation, Cypress, Selenium, Jest, Git"
  }
};

export default function App() {
  // Setup States
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);
  
  const [jobTitle, setJobTitle] = useState('Senior Frontend Engineer (React)');
  const [jobDescription, setJobDescription] = useState(`We are seeking a Senior Frontend Engineer with expert-level React skills. In this role, you will lead the architecture of our user interfaces, mentor junior developers, and coordinate with product managers.

Requirements:
- 5+ years of software development experience.
- Deep expertise in React, JavaScript, and TypeScript.
- Strong proficiency in responsive design (Tailwind CSS, Sass) and state management (Redux, Redux Toolkit, or Zustand).
- Experience with cloud platforms (AWS), version control (Git), and REST/GraphQL APIs.`);
  const [mustHaves, setMustHaves] = useState('React, TypeScript, 5+ years experience, Tailwind CSS, Git');
  
  const [candidates, setCandidates] = useState([
    {
      id: 'demo-1',
      name: 'Rohan Mehta',
      fileName: 'Rohan_Mehta_Resume.pdf',
      fileSize: 4250,
      status: 'ready',
      ocrProgress: 0,
      text: `Rohan Mehta\nLead Software Engineer\nrohan.mehta@email.com\n\nExperience:\n- Lead React Developer at TechCorp (4 years): Spearheaded redevelopment of the enterprise SaaS dashboard using React, Redux, Tailwind CSS, and TypeScript. Optimized client-side performance, reducing load times by 40%.\n- Software Engineer at WebFlow (3 years): Built RESTful APIs using Node.js and Express. Maintained PostgreSQL databases. Worked in Agile/Scrum teams.\n\nSkills: React, Redux, JavaScript, TypeScript, Node.js, HTML5, CSS3, AWS, PostgreSQL, Git, Agile, System Design, REST APIs, Tailwind CSS.\n\nEducation:\nBachelor of Technology in Computer Science`,
      numChars: 652,
      errorDetails: '',
      score: null,
      evaluation: null,
      stage: 'screening',
      noticePeriod: "Immediate",
      currentCtc: 14,
      expectedCtc: 18,
      location: "Mumbai",
      preferredLocation: "Mumbai, Bangalore",
      resumeQuality: 92,
      scorecard: {
        technical: 5,
        communication: 4,
        problemSolving: 4,
        cultureFit: 5,
        notes: "Excellent technical alignment, strong architecture experience. Communication is clean and concise."
      },
      activityLog: [
        { id: 1, type: "applied", text: "Candidate profile added to screening queue", timestamp: "2026-06-13 10:45 AM" }
      ]
    },
    {
      id: 'demo-2',
      name: 'Priya Patel',
      fileName: 'Priya_Patel_CV.docx',
      fileSize: 5120,
      status: 'ready',
      ocrProgress: 0,
      text: `Priya Patel\nSenior Frontend Engineer\npriya.patel@email.com\n\nSummary: 6+ years of experience specializing in frontend architectures. Expert in React, Next.js, TypeScript, and state management.\n\nExperience:\n- Senior Frontend Engineer at CloudScale (3 years): Designed scalable microservices frontend using Next.js, React, Tailwind, and GraphQL. Mentored 4 junior developers.\n- Frontend Engineer at AppStudio (3 years): Developed responsive web interfaces using Vue, Vuex, Tailwind, and Jest.\n\nSkills: React, Next.js, JavaScript, TypeScript, Tailwind, CSS, Git, Jest, GraphQL, UI/UX, Agile, Mentoring.\n\nEducation:\nMaster of Science in Computer Science`,
      numChars: 680,
      errorDetails: '',
      score: null,
      evaluation: null,
      stage: 'screening',
      noticePeriod: "30 days",
      currentCtc: 20,
      expectedCtc: 24,
      location: "Bangalore",
      preferredLocation: "Bangalore, Remote",
      resumeQuality: 95,
      scorecard: {
        technical: 5,
        communication: 5,
        problemSolving: 5,
        cultureFit: 4,
        notes: "Top-tier candidate. Very strong frontend design patterns. Led a small team before."
      },
      activityLog: [
        { id: 1, type: "applied", text: "Candidate profile added to screening queue", timestamp: "2026-06-13 10:45 AM" }
      ]
    },
    {
      id: 'demo-3',
      name: 'David Chen',
      fileName: 'David_Chen_Resume.txt',
      fileSize: 1850,
      status: 'ready',
      ocrProgress: 0,
      text: `David Chen\nSoftware Developer\ndavid.chen@email.com\n\nSummary: Motivated Software Developer with 2 years of experience in React and web design. Eager to grow.\n\nExperience:\n- Junior Developer at StartUp Inc (2 years): Assisted in building React client pages and styling with Bootstrap. Resolved frontend bugs.\n\nSkills: React, JavaScript, HTML, CSS, Git, Bootstrap, Agile.\n\nEducation:\nBachelor of Science in Information Technology`,
      numChars: 405,
      errorDetails: '',
      score: null,
      evaluation: null,
      stage: 'screening',
      noticePeriod: "15 days",
      currentCtc: 6,
      expectedCtc: 8,
      location: "Pune",
      preferredLocation: "Pune, Mumbai",
      resumeQuality: 78,
      scorecard: {
        technical: 3,
        communication: 4,
        problemSolving: 3,
        cultureFit: 4,
        notes: "Enthusiastic but junior. Needs mentorship. Good basic React and styling knowledge."
      },
      activityLog: [
        { id: 1, type: "applied", text: "Candidate profile added to screening queue", timestamp: "2026-06-13 10:45 AM" }
      ]
    },
    {
      id: 'demo-4',
      name: 'Sarah Connor',
      fileName: 'Sarah_Connor_Resume.pdf',
      fileSize: 3900,
      status: 'ready',
      ocrProgress: 0,
      text: `Sarah Connor\nBackend Engineer\nsarah.c@email.com\n\nSummary: Backend specialist with 5 years of experience building scalable data APIs and cloud infrastructures.\n\nExperience:\n- Senior Backend Engineer at DataDrive (3 years): Engineered data processing ETL pipelines in Python and Django. Managed AWS deployment with Kubernetes and Docker.\n- Backend Developer at SafeTech (2 years): Built secure Java Spring Boot microservices.\n\nSkills: Python, Django, Java, Spring Boot, AWS, Docker, Kubernetes, SQL, PostgreSQL, REST APIs, Microservices, CI/CD, Git.\n\nEducation:\nBachelor of Science in Computer Engineering`,
      numChars: 624,
      errorDetails: '',
      score: null,
      evaluation: null,
      stage: 'screening',
      noticePeriod: "Immediate",
      currentCtc: 13,
      expectedCtc: 16,
      location: "Hyderabad",
      preferredLocation: "Hyderabad, Bangalore",
      resumeQuality: 88,
      scorecard: {
        technical: 4,
        communication: 3,
        problemSolving: 4,
        cultureFit: 3,
        notes: "Solid backend pipelines. Communication is very direct. Lacks React knowledge."
      },
      activityLog: [
        { id: 1, type: "applied", text: "Candidate profile added to screening queue", timestamp: "2026-06-13 10:45 AM" }
      ]
    },
    {
      id: 'demo-5',
      name: 'Marcus Vance',
      fileName: 'Marcus_Vance_Resume.docx',
      fileSize: 6100,
      status: 'ready',
      ocrProgress: 0,
      text: `Marcus Vance\nEngineering Manager / Team Lead\nmarcus.v@email.com\n\nSummary: Agile Leader and Developer with 8 years of experience leading software development teams and designing business applications.\n\nExperience:\n- Engineering Manager at Innovate Ltd (3 years): Led a team of 10 developers building corporate tools. Managed Agile delivery schedules and scrum ceremonies.\n- Technical Team Lead at DevPartners (3 years): Mentored junior team members, ran code reviews, and managed git release branches.\n- Software Developer at WebCorp (2 years): Built backend Java services.\n\nSkills: Project Management, Agile Delivery, Scrum Master, Leadership, Team Management, Git, Java, Agile, JIRA, Budgeting.\n\nEducation:\nMaster of Business Administration (MBA)\nBachelor of Science in Management`,
      numChars: 808,
      errorDetails: '',
      score: null,
      evaluation: null,
      stage: 'screening',
      noticePeriod: "60 days",
      currentCtc: 28,
      expectedCtc: 32,
      location: "Delhi NCR",
      preferredLocation: "Delhi NCR, Remote",
      resumeQuality: 85,
      scorecard: {
        technical: 3,
        communication: 5,
        problemSolving: 4,
        cultureFit: 5,
        notes: "Strong leadership and process. Agile champion. Technical depth in frontend is limited."
      },
      activityLog: [
        { id: 1, type: "applied", text: "Candidate profile added to screening queue", timestamp: "2026-06-13 10:45 AM" }
      ]
    },
    {
      id: 'demo-6',
      name: 'Elena Rostova',
      fileName: 'Elena_Rostova_QA_CV.pdf',
      fileSize: 2980,
      status: 'ready',
      ocrProgress: 0,
      text: `Elena Rostova\nQA Automation Engineer\elena.r@email.com\n\nSummary: QA Automation specialist with 3 years of experience writing automated test suites and verifying software quality.\n\nExperience:\n- QA Engineer at QualityFirst (3 years): Developed automated testing scripts using Selenium, Cypress, and Jest. Conducted manual regression testing.\n\nSkills: QA, Testing, Cypress, Jest, Selenium, JavaScript, Git, Agile.\n\nEducation:\nBachelor of Science in Software Engineering`,
      numChars: 486,
      errorDetails: '',
      score: null,
      evaluation: null,
      stage: 'screening',
      noticePeriod: "30 days",
      currentCtc: 8,
      expectedCtc: 10,
      location: "Chennai",
      preferredLocation: "Chennai, Bangalore",
      resumeQuality: 80,
      scorecard: {
        technical: 4,
        communication: 4,
        problemSolving: 3,
        cultureFit: 4,
        notes: "Good QA automation background. Cypress and Jest experience fits well."
      },
      activityLog: [
        { id: 1, type: "applied", text: "Candidate profile added to screening queue", timestamp: "2026-06-13 10:45 AM" }
      ]
    }
  ]);
  const [threshold, setThreshold] = useState(70);
  
  // Notice Period & Compensation filter states
  const [maxExpectedCtc, setMaxExpectedCtc] = useState(40);
  const [noticePeriodFilter, setNoticePeriodFilter] = useState('any');
  const [locationFilter, setLocationFilter] = useState('');
  
  // Slide-out Drawer active candidate profile and tabs
  const [activeDrawerCandidateId, setActiveDrawerCandidateId] = useState(null);
  const [drawerActiveTab, setDrawerActiveTab] = useState('overview'); // 'overview' | 'resume' | 'scorecard' | 'timeline'
  const [interviewerName, setInterviewerName] = useState('Lead Frontend Architect');
  const [interviewDateTime, setInterviewDateTime] = useState('');
  const [interviewAgenda, setInterviewAgenda] = useState('Technical Screening & Coding Evaluation');
  
  // PyjamaHR Collaborative Ratings and Careers Page preview states
  const [activeCollaborator, setActiveCollaborator] = useState('recruiter'); // 'recruiter' | 'technical' | 'hr'
  const [isCareersPreviewOpen, setIsCareersPreviewOpen] = useState(false);
  const [appFormName, setAppFormName] = useState('');
  const [appFormEmail, setAppFormEmail] = useState('');
  const [appFormResume, setAppFormResume] = useState('');
  const [appSubmitted, setAppSubmitted] = useState(false);
  
  // OCR & Reading State
  const [dragActive, setDragActive] = useState(false);
  const [pasteFallbackOpen, setPasteFallbackOpen] = useState(false);
  const [pasteName, setPasteName] = useState('');
  const [pasteText, setPasteText] = useState('');
  
  // Screening Execution State
  const [isScreening, setIsScreening] = useState(false);
  const [currentScreenIndex, setCurrentScreenIndex] = useState(-1);
  const [screeningError, setScreeningError] = useState(null);
  
  // Email States
  const [emailDrafts, setEmailDrafts] = useState({});
  const [isDraftingId, setIsDraftingId] = useState(null);

  // Selection & Sending States
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [sentEmails, setSentEmails] = useState({}); // { id: { sentAt: string, subject: string, body: string, email: string, from: string } }
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [activeEmailCandidateId, setActiveEmailCandidateId] = useState(null);
  const [editedEmailDrafts, setEditedEmailDrafts] = useState({}); // { id: { subject: string, body: string } }
  const [editedEmailRecipients, setEditedEmailRecipients] = useState({}); // { id: string }
  const [sendingStatus, setSendingStatus] = useState({ state: 'idle', progress: 0, activeName: '' }); // 'idle' | 'sending' | 'completed'
  const [senderEmail, setSenderEmail] = useState('admink338@gmail.com');

  // Multi-Job Openings Management States
  const [jobs, setJobs] = useState([
    {
      id: 'job-1',
      title: 'Senior Frontend Engineer (React)',
      description: JD_TEMPLATES.react_developer.description,
      mustHaves: JD_TEMPLATES.react_developer.mustHaves
    },
    {
      id: 'job-2',
      title: 'Senior Data Scientist (Python / AI)',
      description: JD_TEMPLATES.python_data_scientist.description,
      mustHaves: JD_TEMPLATES.python_data_scientist.mustHaves
    },
    {
      id: 'job-3',
      title: 'Technical Product Manager',
      description: JD_TEMPLATES.product_manager.description,
      mustHaves: JD_TEMPLATES.product_manager.mustHaves
    }
  ]);
  const [activeJobId, setActiveJobId] = useState('job-1');
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobDesc, setNewJobDesc] = useState('');
  const [newJobMustHaves, setNewJobMustHaves] = useState('');

  // Additional PyjamaHR Extension States
  const [activeSkillFilters, setActiveSkillFilters] = useState([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState('Recruiter Note');
  const [isCustomizingTemplate, setIsCustomizingTemplate] = useState(false);
  const [tempSubject, setTempSubject] = useState('');
  const [tempBody, setTempBody] = useState('');
  const [careersTheme, setCareersTheme] = useState('indigo');
  const [careersFont, setCareersFont] = useState('sans');

  const tempSubjectRef = useRef(null);
  const tempBodyRef = useRef(null);

  const getActiveJobData = (candidate, jobId) => {
    const defaultData = {
      score: null,
      evaluation: null,
      stage: 'screening',
      scorecard: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "" },
      collaboratorRatings: {
        recruiter: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "" },
        technical: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "" },
        hr: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "" }
      },
      activityLog: [
        { id: 1, type: "applied", text: "Candidate profile added to screening queue", timestamp: "2026-06-13 10:45 AM" }
      ]
    };
    if (!candidate.jobsData) return defaultData;
    return candidate.jobsData[jobId] || defaultData;
  };

  const getEnrichedCandidate = (c) => {
    const jobData = getActiveJobData(c, activeJobId);
    return {
      ...c,
      ...jobData,
      status: (c.status === 'completed' && !jobData.score) ? 'ready' : c.status
    };
  };

  const enrichedCandidates = candidates.map(getEnrichedCandidate);

  const handleSelectJob = (jobId) => {
    setActiveJobId(jobId);
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      setJobTitle(job.title);
      setJobDescription(job.description);
      setMustHaves(job.mustHaves);
    }
  };

  const handleUpdateJobField = (field, value) => {
    if (field === 'title') setJobTitle(value);
    else if (field === 'description') setJobDescription(value);
    else if (field === 'mustHaves') setMustHaves(value);
    
    setJobs(prev => prev.map(j => {
      if (j.id === activeJobId) {
        return {
          ...j,
          [field]: value
        };
      }
      return j;
    }));
  };

  const updateCandidateJobData = (candidateId, updatedFields) => {
    setCandidates(prev => prev.map(c => {
      if (c.id === candidateId) {
        const jData = c.jobsData || {};
        const currentJobData = jData[activeJobId] || getActiveJobData(c, activeJobId);
        return {
          ...c,
          jobsData: {
            ...jData,
            [activeJobId]: {
              ...currentJobData,
              ...updatedFields
            }
          }
        };
      }
      return c;
    }));
  };

  const handleAddTimelineActivity = (candidateId) => {
    if (!newNoteText.trim()) return;

    const candidate = enrichedCandidates.find(c => c.id === candidateId);
    if (!candidate) return;

    const timeStr = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedLog = [...(candidate.activityLog || [])];
    const categoryLabel = newNoteCategory || 'Recruiter Note';

    updatedLog.push({
      id: updatedLog.length + 1,
      type: "note",
      text: `✍ [${categoryLabel}] ${newNoteText.trim()}`,
      timestamp: timeStr
    });

    updateCandidateJobData(candidateId, {
      evaluation: candidate.evaluation ? {
        ...candidate.evaluation,
        activity_log: updatedLog
      } : null,
      activityLog: updatedLog
    });

    setNewNoteText('');
  };

  const getTrendingSkills = () => {
    const rawSkills = mustHaves 
      ? mustHaves.split(',').map(s => s.trim()).filter(Boolean)
      : ['React', 'TypeScript', 'Sass', 'Git', 'AWS'];
    
    return rawSkills.filter(s => {
      const lower = s.toLowerCase();
      return !lower.includes('years') && !lower.includes('exp') && !lower.includes('experience') && !lower.includes('yr');
    });
  };

  const handleToggleSkillFilter = (skillName) => {
    setActiveSkillFilters(prev => 
      prev.includes(skillName) 
        ? prev.filter(s => s !== skillName) 
        : [...prev, skillName]
    );
  };

  const insertPlaceholder = (target, placeholder) => {
    let inputEl;
    let value;
    let setValue;

    if (target === 'subject') {
      inputEl = tempSubjectRef.current;
      value = tempSubject;
      setValue = setTempSubject;
    } else {
      inputEl = tempBodyRef.current;
      value = tempBody;
      setValue = setTempBody;
    }

    if (!inputEl) {
      setValue(prev => prev + placeholder);
      return;
    }

    const start = inputEl.selectionStart;
    const end = inputEl.selectionEnd;
    const text = inputEl.value;
    const before = text.substring(0, start);
    const after  = text.substring(end, text.length);

    setValue(before + placeholder + after);

    setTimeout(() => {
      inputEl.focus();
      inputEl.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 10);
  };

  const handleSaveCustomTemplate = () => {
    setEmailTemplates(prev => prev.map(t => {
      if (t.id === selectedTemplateId) {
        return {
          ...t,
          subject: tempSubject,
          body: tempBody
        };
      }
      return t;
    }));
    
    const updatedDrafts = { ...editedEmailDrafts };
    for (const id of selectedCandidateIds) {
      const candidate = candidates.find(c => c.id === id);
      if (candidate) {
        updatedDrafts[id] = {
          subject: resolveTemplatePlaceholders(tempSubject, candidate, jobTitle),
          body: resolveTemplatePlaceholders(tempBody, candidate, jobTitle)
        };
      }
    }
    setEditedEmailDrafts(updatedDrafts);
    setIsCustomizingTemplate(false);
    alert("🎉 Template layout customized and applied to all pending drafts!");
  };

  useEffect(() => {
    // Screen demo candidates for job-1 on mount dynamically
    setCandidates(prev => prev.map(c => {
      if (c.id.startsWith('demo-') && (!c.jobsData || !c.jobsData['job-1'])) {
        const evalData = analyzeCandidateOffline(c, 'Senior Frontend Engineer (React)', JD_TEMPLATES.react_developer.description, JD_TEMPLATES.react_developer.mustHaves);
        const jData = c.jobsData || {};
        
        // Mock collaborator reviews to populate ratings
        const mockRatings = {
          recruiter: c.scorecard || { technical: 5, communication: 4, problemSolving: 4, cultureFit: 5, notes: "Excellent technical alignment, strong architecture experience." },
          technical: { technical: 4, communication: 4, problemSolving: 4, cultureFit: 4, notes: "Good React fundamentals and coding practice." },
          hr: { technical: 4, communication: 5, problemSolving: 4, cultureFit: 5, notes: "Very professional communication and alignment with culture." }
        };

        jData['job-1'] = {
          score: evalData.calculatedScore,
          evaluation: evalData,
          stage: c.stage || 'screening',
          scorecard: mockRatings.recruiter,
          collaboratorRatings: mockRatings,
          activityLog: c.activityLog || [
            { id: 1, type: "applied", text: "Candidate profile added to screening queue", timestamp: "2026-06-13 10:45 AM" },
            { id: 2, type: "screened", text: `ATS Match Screen complete. ATS Score: ${evalData.calculatedScore}%`, timestamp: "2026-06-13 10:46 AM" }
          ]
        };
        return {
          ...c,
          status: 'completed',
          jobsData: jData
        };
      }
      return c;
    }));
  }, []);

  // Extension Features States
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'kanban'
  const [expandedResumeIds, setExpandedResumeIds] = useState([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('interview_invitation');
  const [searchQuery, setSearchQuery] = useState('');
  const [minScoreFilter, setMinScoreFilter] = useState(50);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [emailTemplates, setEmailTemplates] = useState([
    {
      id: 'interview_invitation',
      name: 'Interview Invitation',
      subject: 'Interview Invitation: {{jobTitle}} - {{candidateName}}',
      body: `Dear {{candidateName}},\n\nThank you for your interest in the {{jobTitle}} position at our firm. We have completed our initial evaluation of your resume and are delighted to let you know that your profile matches our requirements. We were particularly impressed by your skills in {{matchedSkills}} and your depth of experience.\n\nWe would like to invite you for a 30-minute virtual interview with our engineering/product team. This conversation will give us a chance to learn more about your technical journey and share more details about the role and our roadmap.\n\nPlease let us know your availability over the next few business days by replying to this email.\n\nBest regards,\nThe Recruiting Team\nRecruitPro ATS`
    },
    {
      id: 'phone_screen',
      name: 'Recruiter Phone Screen',
      subject: 'Follow-up on your application: {{jobTitle}} - {{candidateName}}',
      body: `Dear {{candidateName}},\n\nThank you for applying for the {{jobTitle}} position. We have reviewed your resume and find your background very interesting.\n\nTo help us better understand your specific experience and see how it aligns with our immediate needs, we would like to schedule a brief 15-minute phone screening.\n\nPlease let us know your availability for a quick call this week, along with the best phone number to reach you.\n\nBest regards,\nThe Recruiting Team\nRecruitPro ATS`
    },
    {
      id: 'talent_pool',
      name: 'Hold in Talent Pool',
      subject: 'Application Update: {{jobTitle}} - {{candidateName}}',
      body: `Dear {{candidateName}},\n\nThank you for your interest in the {{jobTitle}} position. We have reviewed your qualifications and appreciate the time and effort you put into your application.\n\nAt the moment, we are interviewing candidates whose profiles have a more direct alignment with our immediate requirements for this active opening. However, given your impressive skills and experience, we would like to keep your profile on file in our talent pool for future positions that match your background.\n\nWe will keep you updated if a suitable opportunity arises. Thank you again, and we wish you the best of luck in your current search.\n\nBest regards,\nThe Recruiting Team\nRecruitPro ATS`
    },
    {
      id: 'decline_courtesy',
      name: 'Decline with Courtesy',
      subject: 'Update regarding your application: {{jobTitle}} - {{candidateName}}',
      body: `Dear {{candidateName}},\n\nThank you for taking the time to apply for the {{jobTitle}} position and for your interest in our company.\n\nAfter careful consideration of all applications, we regret to inform you that we have decided to move forward with other candidates whose backgrounds more closely match the technical requirements of this specific opening.\n\nWe appreciate the opportunity to review your profile and wish you success in your professional endeavors.\n\nBest regards,\nThe Recruiting Team\nRecruitPro ATS`
    },
    {
      id: 'offer_extended',
      name: 'Job Offer Extended',
      subject: 'Official Job Offer: {{jobTitle}} - {{candidateName}}',
      body: `Dear {{candidateName}},\n\nWe are absolutely thrilled to offer you the position of {{jobTitle}}!\n\nOur team was incredibly impressed by your qualifications, experience, and the technical depth you demonstrated during the interview process. We believe your skills will be a fantastic asset to our team and that you will thrive in our collaborative culture.\n\nWe will follow up shortly with a detailed offer letter outlining your compensation package, benefits, and start date details.\n\nCongratulations! We look forward to welcoming you to the company.\n\nBest regards,\nThe Recruiting Team\nRecruitPro ATS`
    }
  ]);
  
  // File JD uploading states
  const jdFileInputRef = useRef(null);
  const candidateFileInputRef = useRef(null);

  // Supabase states and configuration
  const [supabaseStatus, setSupabaseStatus] = useState('connecting'); // 'connecting' | 'connected' | 'schema_missing' | 'error' | 'offline'
  const [supabaseError, setSupabaseError] = useState(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Synchronization refs to prevent feedback loops
  const prevCandidatesRef = useRef(candidates);
  const prevJobsRef = useRef(jobs);
  const prevTemplatesRef = useRef(emailTemplates);

  const seedSupabase = async () => {
    try {
      setIsSeeding(true);
      // 1. Seed jobs
      const { error: jobsErr } = await supabase.from('jobs').upsert(jobs);
      if (jobsErr) throw jobsErr;

      // 2. Seed candidates
      const { error: candErr } = await supabase.from('candidates').upsert(candidates);
      if (candErr) throw candErr;

      // 3. Seed email templates
      const { error: tempErr } = await supabase.from('email_templates').upsert(emailTemplates);
      if (tempErr) throw tempErr;

      alert("🎉 Supabase database seeded successfully with default data!");
      
      // Update refs to reflect seeded data
      prevJobsRef.current = jobs;
      prevCandidatesRef.current = candidates;
      prevTemplatesRef.current = emailTemplates;
      
      setSupabaseStatus('connected');
    } catch (err) {
      console.error("Error seeding Supabase:", err);
      alert("❌ Seeding failed: " + err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  const verifySupabaseConnection = async (forceAlert = false) => {
    try {
      setSupabaseStatus('connecting');
      setSupabaseError(null);

      // Test query jobs
      const { error: jobsError } = await supabase
        .from('jobs')
        .select('id')
        .limit(1);

      if (jobsError) {
        if (jobsError.message.includes('relation "public.jobs" does not exist') || jobsError.code === '42P01') {
          setSupabaseStatus('schema_missing');
          if (forceAlert) alert("⚠️ Connection successful, but tables do not exist. Please run the SQL DDL block in your Supabase SQL Editor!");
          return;
        }
        throw jobsError;
      }

      // Test query candidates
      const { error: candidatesError } = await supabase
        .from('candidates')
        .select('id')
        .limit(1);

      if (candidatesError) {
        if (candidatesError.message.includes('relation "public.candidates" does not exist') || candidatesError.code === '42P01') {
          setSupabaseStatus('schema_missing');
          if (forceAlert) alert("⚠️ Connection successful, but tables do not exist. Please run the SQL DDL block in your Supabase SQL Editor!");
          return;
        }
        throw candidatesError;
      }

      // Test query templates
      const { error: templatesError } = await supabase
        .from('email_templates')
        .select('id')
        .limit(1);

      if (templatesError) {
        if (templatesError.message.includes('relation "public.email_templates" does not exist') || templatesError.code === '42P01') {
          setSupabaseStatus('schema_missing');
          if (forceAlert) alert("⚠️ Connection successful, but tables do not exist. Please run the SQL DDL block in your Supabase SQL Editor!");
          return;
        }
        throw templatesError;
      }

      // Load data
      const { data: dbJobs, error: fJobsErr } = await supabase.from('jobs').select('*').order('created_at', { ascending: true });
      if (fJobsErr) throw fJobsErr;

      const { data: dbCandidates, error: fCandErr } = await supabase.from('candidates').select('*').order('created_at', { ascending: true });
      if (fCandErr) throw fCandErr;

      const { data: dbTemplates, error: fTempErr } = await supabase.from('email_templates').select('*').order('created_at', { ascending: true });
      if (fTempErr) throw fTempErr;

      let seededAny = false;

      // Seed jobs if empty
      if (dbJobs && dbJobs.length > 0) {
        prevJobsRef.current = dbJobs;
        setJobs(dbJobs);
      } else {
        const { error: err } = await supabase.from('jobs').upsert(jobs);
        if (err) throw err;
        seededAny = true;
      }

      // Seed candidates if empty
      if (dbCandidates && dbCandidates.length > 0) {
        prevCandidatesRef.current = dbCandidates;
        setCandidates(dbCandidates);
      } else {
        const { error: err } = await supabase.from('candidates').upsert(candidates);
        if (err) throw err;
        seededAny = true;
      }

      // Seed templates if empty
      if (dbTemplates && dbTemplates.length > 0) {
        prevTemplatesRef.current = dbTemplates;
        setEmailTemplates(dbTemplates);
      } else {
        const { error: err } = await supabase.from('email_templates').upsert(emailTemplates);
        if (err) throw err;
        seededAny = true;
      }

      if (seededAny) {
        // Refetch to make sure states align perfectly with DB primary key metadata
        const { data: refreshedJobs } = await supabase.from('jobs').select('*').order('created_at', { ascending: true });
        if (refreshedJobs) {
          prevJobsRef.current = refreshedJobs;
          setJobs(refreshedJobs);
        }
        const { data: refreshedCandidates } = await supabase.from('candidates').select('*').order('created_at', { ascending: true });
        if (refreshedCandidates) {
          prevCandidatesRef.current = refreshedCandidates;
          setCandidates(refreshedCandidates);
        }
        const { data: refreshedTemplates } = await supabase.from('email_templates').select('*').order('created_at', { ascending: true });
        if (refreshedTemplates) {
          prevTemplatesRef.current = refreshedTemplates;
          setEmailTemplates(refreshedTemplates);
        }
      }

      setSupabaseStatus('connected');
      if (forceAlert) {
        alert("🎉 Supabase connection verified! Data loaded successfully.");
      }
    } catch (err) {
      console.error("Supabase verification failed:", err);
      setSupabaseStatus('error');
      setSupabaseError(err.message);
      if (forceAlert) {
        alert("❌ Supabase connection verification failed: " + err.message);
      }
    }
  };

  // Run verify on mount
  useEffect(() => {
    verifySupabaseConnection();
  }, []);

  // Sync Candidates to Supabase
  useEffect(() => {
    if (supabaseStatus !== 'connected') {
      prevCandidatesRef.current = candidates;
      return;
    }

    const syncCandidates = async () => {
      try {
        const prev = prevCandidatesRef.current;
        
        // Find deleted
        const deleted = prev.filter(p => !candidates.some(c => c.id === p.id));
        for (const d of deleted) {
          await supabase.from('candidates').delete().eq('id', d.id);
        }

        // Find upserted
        const changed = candidates.filter(c => {
          const p = prev.find(prevC => prevC.id === c.id);
          if (!p) return true;
          return JSON.stringify(p) !== JSON.stringify(c);
        });

        if (changed.length > 0) {
          await supabase.from('candidates').upsert(changed);
        }

        prevCandidatesRef.current = candidates;
      } catch (err) {
        console.error("Supabase candidates sync error:", err);
      }
    };

    syncCandidates();
  }, [candidates, supabaseStatus]);

  // Sync Jobs to Supabase
  useEffect(() => {
    if (supabaseStatus !== 'connected') {
      prevJobsRef.current = jobs;
      return;
    }

    const syncJobs = async () => {
      try {
        const prev = prevJobsRef.current;

        // Find deleted
        const deleted = prev.filter(p => !jobs.some(j => j.id === p.id));
        for (const d of deleted) {
          await supabase.from('jobs').delete().eq('id', d.id);
        }

        // Find upserted
        const changed = jobs.filter(j => {
          const p = prev.find(prevJ => prevJ.id === j.id);
          if (!p) return true;
          return JSON.stringify(p) !== JSON.stringify(j);
        });

        if (changed.length > 0) {
          await supabase.from('jobs').upsert(changed);
        }

        prevJobsRef.current = jobs;
      } catch (err) {
        console.error("Supabase jobs sync error:", err);
      }
    };

    syncJobs();
  }, [jobs, supabaseStatus]);

  // Sync Email Templates to Supabase
  useEffect(() => {
    if (supabaseStatus !== 'connected') {
      prevTemplatesRef.current = emailTemplates;
      return;
    }

    const syncTemplates = async () => {
      try {
        const prev = prevTemplatesRef.current;

        // Find deleted
        const deleted = prev.filter(p => !emailTemplates.some(t => t.id === p.id));
        for (const d of deleted) {
          await supabase.from('email_templates').delete().eq('id', d.id);
        }

        // Find upserted
        const changed = emailTemplates.filter(t => {
          const p = prev.find(prevT => prevT.id === t.id);
          if (!p) return true;
          return JSON.stringify(p) !== JSON.stringify(t);
        });

        if (changed.length > 0) {
          await supabase.from('email_templates').upsert(changed);
        }

        prevTemplatesRef.current = emailTemplates;
      } catch (err) {
        console.error("Supabase templates sync error:", err);
      }
    };

    syncTemplates();
  }, [emailTemplates, supabaseStatus]);

  // Format File Size
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Safe file text extraction parser
  const readFileText = async (file, onProgressUpdate) => {
    const name = file.name.toLowerCase();
    
    // 1. Text files
    if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.json') || name.endsWith('.csv')) {
      return await file.text();
    }
    
    // 2. Word Document files
    if (name.endsWith('.docx')) {
      try {
        const mammothLib = await loadMammoth();
        if (!mammothLib) throw new Error("Mammoth library failed to load");
        const arrayBuffer = await file.arrayBuffer();
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        return result.value;
      } catch (err) {
        throw new Error(`Word parse failed: ${err.message}`);
      }
    }
    
    // 3. PDF Files
    if (name.endsWith('.pdf')) {
      try {
        const pdfjs = await loadPdfJs();
        if (!pdfjs) throw new Error("PDF.js library failed to load");
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          text += pageText + '\n';
        }
        
        // Scanned PDF detection: if text is empty/very short, fall back to OCR
        if (text.trim().length < 20) {
          onProgressUpdate('ocr', 0);
          let ocrText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // Adjust scale to balance quality and speed
            const viewport = page.getViewport({ scale: 1.5 });
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({ canvasContext: context, viewport }).promise;
            
            const pageText = await runOcrWithTimeout(canvas, (p) => {
              const overallProgress = Math.round(((i - 1) * 100 + p) / pdf.numPages);
              onProgressUpdate('ocr', overallProgress);
            });
            ocrText += pageText + '\n';
          }
          return ocrText;
        }
        return text;
      } catch (err) {
        throw new Error(`PDF parse failed: ${err.message}`);
      }
    }
    
    // 4. Image Files
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')) {
      try {
        onProgressUpdate('ocr', 0);
        const text = await runOcrWithTimeout(file, (p) => {
          onProgressUpdate('ocr', p);
        });
        return text;
      } catch (err) {
        throw new Error(`OCR processing failed: ${err.message}`);
      }
    }
    
    throw new Error("Unsupported file extension. Please upload PDF, DOCX, TXT, or Image files.");
  };

  // Process a selected file for candidate
  const handleCandidateFile = async (file) => {
    const candidateId = Math.random().toString(36).substring(7);
    const newCandidate = {
      id: candidateId,
      name: file.name.replace(/\.[^/.]+$/, ""), // remove extension for default name
      fileName: file.name,
      fileSize: file.size,
      status: 'reading',
      ocrProgress: 0,
      text: '',
      numChars: 0,
      errorDetails: '',
      score: null,
      evaluation: null,
      stage: 'screening'
    };

    // Add candidate to state immediately
    setCandidates(prev => [...prev, newCandidate]);

    try {
      const text = await readFileText(file, (phase, prog) => {
        setCandidates(prev => prev.map(c => {
          if (c.id === candidateId) {
            return { 
              ...c, 
              status: phase === 'ocr' ? 'ocr_progress' : 'reading',
              ocrProgress: prog 
            };
          }
          return c;
        }));
      });
      
      if (!text || text.trim().length === 0) {
        throw new Error("Extracted text is empty. Please verify the document has content.");
      }

      setCandidates(prev => prev.map(c => {
        if (c.id === candidateId) {
          return {
            ...c,
            status: 'ready',
            text: text,
            numChars: text.length
          };
        }
        return c;
      }));
    } catch (err) {
      setCandidates(prev => prev.map(c => {
        if (c.id === candidateId) {
          return {
            ...c,
            status: 'error',
            errorDetails: err.message
          };
        }
        return c;
      }));
    }
  };

  // Run OCR Retry
  const handleOcrRetry = async (candidateId) => {
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;

    setCandidates(prev => prev.map(c => {
      if (c.id === candidateId) {
        return { ...c, status: 'ocr_progress', ocrProgress: 0, errorDetails: '' };
      }
      return c;
    }));

    try {
      // Find the file reference (only works if they drag-dropped or if we find it in browser cache)
      // Since file inputs don't persist file references globally, if they click retry, we need the file.
      // To bypass this, we saved the file reference inside the state or we ask them to use the fallback paste.
      // Wait, we can store the actual File object inside the candidate object!
      // In JS, state can store File objects. Let's do that!
      if (!candidate.fileObject) {
        throw new Error("Original file data lost. Please use the text paste box below or re-upload the file.");
      }

      const text = await readFileText(candidate.fileObject, (phase, prog) => {
        setCandidates(prev => prev.map(c => {
          if (c.id === candidateId) {
            return { 
              ...c, 
              status: 'ocr_progress',
              ocrProgress: prog 
            };
          }
          return c;
        }));
      });

      if (!text || text.trim().length === 0) {
        throw new Error("OCR extracted empty text.");
      }

      setCandidates(prev => prev.map(c => {
        if (c.id === candidateId) {
          return {
            ...c,
            status: 'ready',
            text: text,
            numChars: text.length
          };
        }
        return c;
      }));
    } catch (err) {
      setCandidates(prev => prev.map(c => {
        if (c.id === candidateId) {
          return {
            ...c,
            status: 'error',
            errorDetails: err.message
          };
        }
        return c;
      }));
    }
  };

  // File Upload Handlers (JD)
  const handleJdFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await readFileText(file, () => {});
      setJobDescription(text);
      // Try to parse out the title if possible
      const lines = text.split('\n');
      if (lines.length > 0 && lines[0].trim().length > 3 && lines[0].trim().length < 60) {
        setJobTitle(lines[0].trim());
      }
    } catch (err) {
      alert(`Could not read Job Description file: ${err.message}`);
    }
  };

  // Drag events for Dropzone
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        // Store File Object in React State for retry references
        const candidateId = Math.random().toString(36).substring(7);
        const newCandidate = {
          id: candidateId,
          name: file.name.replace(/\.[^/.]+$/, ""),
          fileName: file.name,
          fileSize: file.size,
          fileObject: file, // Keep file object for OCR retries!
          status: 'reading',
          ocrProgress: 0,
          text: '',
          numChars: 0,
          errorDetails: '',
          score: null,
          evaluation: null,
          stage: 'screening'
        };
        
        setCandidates(prev => [...prev, newCandidate]);
        
        try {
          const text = await readFileText(file, (phase, prog) => {
            setCandidates(prev => prev.map(c => {
              if (c.id === candidateId) {
                return { 
                  ...c, 
                  status: phase === 'ocr' ? 'ocr_progress' : 'reading',
                  ocrProgress: prog 
                };
              }
              return c;
            }));
          });
          
          if (!text || text.trim().length === 0) {
            throw new Error("Extracted text is empty.");
          }

          setCandidates(prev => prev.map(c => {
            if (c.id === candidateId) {
              return {
                ...c,
                status: 'ready',
                text: text,
                numChars: text.length
              };
            }
            return c;
          }));
        } catch (err) {
          setCandidates(prev => prev.map(c => {
            if (c.id === candidateId) {
              return {
                ...c,
                status: 'error',
                errorDetails: err.message
              };
            }
            return c;
          }));
        }
      }
    }
  };

  const handleBrowseFiles = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      for (const file of files) {
        const candidateId = Math.random().toString(36).substring(7);
        const newCandidate = {
          id: candidateId,
          name: file.name.replace(/\.[^/.]+$/, ""),
          fileName: file.name,
          fileSize: file.size,
          fileObject: file, // Keep reference
          status: 'reading',
          ocrProgress: 0,
          text: '',
          numChars: 0,
          errorDetails: '',
          score: null,
          evaluation: null,
          stage: 'screening'
        };
        
        setCandidates(prev => [...prev, newCandidate]);

        // Wrap IIFE to run asynchronously for each file
        (async () => {
          try {
            const text = await readFileText(file, (phase, prog) => {
              setCandidates(prev => prev.map(c => {
                if (c.id === candidateId) {
                  return { 
                    ...c, 
                    status: phase === 'ocr' ? 'ocr_progress' : 'reading',
                    ocrProgress: prog 
                  };
                }
                return c;
              }));
            });
            
            if (!text || text.trim().length === 0) {
              throw new Error("Extracted text is empty.");
            }

            setCandidates(prev => prev.map(c => {
              if (c.id === candidateId) {
                return {
                  ...c,
                  status: 'ready',
                  text: text,
                  numChars: text.length
                };
              }
              return c;
            }));
          } catch (err) {
            setCandidates(prev => prev.map(c => {
              if (c.id === candidateId) {
                return {
                  ...c,
                  status: 'error',
                  errorDetails: err.message
                };
              }
              return c;
            }));
          }
        })();
      }
    }
  };

  // Add Manual Candidate Text Paste
  const handleAddManualCandidate = () => {
    if (!pasteText.trim()) return;

    const name = pasteName.trim() || `Candidate ${candidates.length + 1}`;
    const candidateId = Math.random().toString(36).substring(7);
    
    const newCandidate = {
      id: candidateId,
      name: name,
      fileName: 'Pasted Text',
      fileSize: pasteText.length,
      status: 'ready',
      ocrProgress: 0,
      text: pasteText,
      numChars: pasteText.length,
      errorDetails: '',
      score: null,
      evaluation: null,
      stage: 'screening'
    };

    setCandidates(prev => [...prev, newCandidate]);
    setPasteName('');
    setPasteText('');
    setPasteFallbackOpen(false);
  };

  // Handle Candidate Manual Text Fix (when read failed)
  const handleManualTextPasteFix = (id, text) => {
    if (!text.trim()) return;
    setCandidates(prev => prev.map(c => {
      if (c.id === id) {
        return {
          ...c,
          status: 'ready',
          text: text,
          numChars: text.length,
          errorDetails: ''
        };
      }
      return c;
    }));
  };

  // Remove Candidate
  const removeCandidate = (id) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
    // Remove matching email draft
    setEmailDrafts(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  // LLM Screen and Rank Execution
  const handleScreenAndRank = async () => {
    if (!jobTitle.trim() || !jobDescription.trim()) {
      alert("Please fill in the Job Title and Job Description.");
      return;
    }

    const readyCandidates = enrichedCandidates.filter(c => c.status === 'ready');
    if (readyCandidates.length === 0) {
      alert("No candidates are ready for screening. Please upload résumés first.");
      return;
    }

    setIsScreening(true);
    setScreeningError(null);

    // Sequential Screening
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const enrichedC = getEnrichedCandidate(c);
      if (enrichedC.status !== 'ready') continue;

      setCurrentScreenIndex(i);
      
      setCandidates(prev => prev.map((curr, idx) => {
        if (idx === i) return { ...curr, status: 'screening' };
        return curr;
      }));

      try {
        // Offline Matcher Mode: simulated parsing delay
        await new Promise(resolve => setTimeout(resolve, 120));
        const evaluation = analyzeCandidateOffline(c, jobTitle, jobDescription, mustHaves);
        const calculatedScore = evaluation.calculatedScore;

        const outcome = getNextStepDetails(calculatedScore, threshold);
        let initialStage = 'screening';
        if (outcome.badge === 'Shortlisted') {
          initialStage = 'shortlisted';
        } else if (outcome.badge === 'Not a fit') {
          initialStage = 'rejected';
        }

        setCandidates(prev => prev.map((curr, idx) => {
          if (idx === i) {
            const jData = curr.jobsData || {};
            const initialRatings = {
              recruiter: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "" },
              technical: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "" },
              hr: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "" }
            };
            const initialLog = [
              { id: 1, type: "applied", text: "Candidate profile added to screening queue", timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
              { id: 2, type: "screened", text: `ATS Match Screen complete. ATS Score: ${calculatedScore}%`, timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
            ];
            
            return {
              ...curr,
              status: 'completed',
              jobsData: {
                ...jData,
                [activeJobId]: {
                  score: calculatedScore,
                  evaluation: evaluation,
                  stage: initialStage,
                  scorecard: initialRatings.recruiter,
                  collaboratorRatings: initialRatings,
                  activityLog: initialLog
                }
              }
            };
          }
          return curr;
        }));
      } catch (err) {
        console.error("Screening error for candidate:", c.name, err);
        setCandidates(prev => prev.map((curr, idx) => {
          if (idx === i) {
            return {
              ...curr,
              status: 'failed',
              errorDetails: err.message
            };
          }
          return curr;
        }));
      }
    }

    // Auto-select shortlisted candidates based on job-specific score
    setCandidates(currentCandidates => {
      const newlySelectedIds = currentCandidates
        .filter(c => {
          const jData = getActiveJobData(c, activeJobId);
          return c.status === 'completed' && jData.score >= threshold;
        })
        .map(c => c.id);
      setSelectedCandidateIds(prev => {
        const combined = new Set([...prev, ...newlySelectedIds]);
        return Array.from(combined);
      });
      return currentCandidates;
    });

    setIsScreening(false);
    setCurrentScreenIndex(-1);
  };

  const handleToggleSelectCandidate = (id) => {
    setSelectedCandidateIds(prev => 
      prev.includes(id) ? prev.filter(candId => candId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = (completedList) => {
    const completedIds = completedList.map(c => c.id);
    const allSelected = completedIds.every(id => selectedCandidateIds.includes(id));
    if (allSelected) {
      setSelectedCandidateIds(prev => prev.filter(id => !completedIds.includes(id)));
    } else {
      setSelectedCandidateIds(prev => {
        const union = new Set([...prev, ...completedIds]);
        return Array.from(union);
      });
    }
  };

  const handleOpenEmailModal = () => {
    if (selectedCandidateIds.length === 0) return;
    
    setActiveEmailCandidateId(selectedCandidateIds[0]);
    setIsEmailModalOpen(true);
    setSendingStatus({ state: 'idle', progress: 0, activeName: '' });

    const updatedDrafts = { ...editedEmailDrafts };
    const updatedRecipients = { ...editedEmailRecipients };
    for (const id of selectedCandidateIds) {
      const candidate = candidates.find(c => c.id === id);
      if (candidate) {
        if (!updatedDrafts[id]) {
          const nextStep = getNextStepDetails(candidate.score, threshold);
          const rawDraft = generateOfflineEmailDraft(candidate, nextStep, jobTitle);
          const parsed = parseEmailDraft(rawDraft);
          updatedDrafts[id] = parsed;
        }
        if (!updatedRecipients[id]) {
          updatedRecipients[id] = extractEmail(candidate);
        }
      }
    }
    setEditedEmailDrafts(updatedDrafts);
    setEditedEmailRecipients(updatedRecipients);
  };

  const handleUpdateDraftRecipient = (id, newRecipient) => {
    setEditedEmailRecipients(prev => ({
      ...prev,
      [id]: newRecipient
    }));
  };

  const handleUpdateDraftSubject = (id, newSubject) => {
    setEditedEmailDrafts(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        subject: newSubject
      }
    }));
  };

  const handleUpdateDraftBody = (id, newBody) => {
    setEditedEmailDrafts(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        body: newBody
      }
    }));
  };

  const handleSendStepEmail = () => {
    if (!activeEmailCandidateId) return;
    const candidate = candidates.find(c => c.id === activeEmailCandidateId);
    if (!candidate) return;

    const draft = editedEmailDrafts[activeEmailCandidateId] || parseEmailDraft(generateOfflineEmailDraft(candidate, getNextStepDetails(candidate.score, threshold), jobTitle));
    const email = editedEmailRecipients[activeEmailCandidateId] || extractEmail(candidate);
    const now = new Date();
    const sentTimeStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Update sent emails state
    setSentEmails(prev => ({
      ...prev,
      [activeEmailCandidateId]: {
        sentAt: sentTimeStr,
        subject: draft.subject,
        body: draft.body,
        email: email,
        from: senderEmail
      }
    }));

    // Open email composer in new window/tab safely (user triggered click = no popup block)
    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
    window.open(mailtoUrl, '_blank');

    // Auto-advance to the next unsent candidate
    const remainingUnsent = selectedCandidateIds.filter(id => id !== activeEmailCandidateId && !sentEmails[id]);
    if (remainingUnsent.length > 0) {
      setActiveEmailCandidateId(remainingUnsent[0]);
    } else {
      setSendingStatus({
        state: 'completed',
        progress: 100,
        activeName: ''
      });
    }
  };

  const handleNextCandidateInQueue = () => {
    const remainingUnsent = selectedCandidateIds.filter(id => !sentEmails[id]);
    if (remainingUnsent.length > 0) {
      setActiveEmailCandidateId(remainingUnsent[0]);
    } else {
      setSendingStatus({
        state: 'completed',
        progress: 100,
        activeName: ''
      });
    }
  };

  const handleSendSingleEmail = async (candidate) => {
    const draftText = emailDrafts[candidate.id];
    if (!draftText) return;
    
    const draft = parseEmailDraft(draftText);
    const email = extractEmail(candidate);
    const now = new Date();
    const sentTimeStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    setSentEmails(prev => ({
      ...prev,
      [candidate.id]: {
        sentAt: sentTimeStr,
        subject: draft.subject,
        body: draft.body,
        email: email,
        from: senderEmail
      }
    }));

    // Open email client
    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
    window.open(mailtoUrl, '_blank');
    
    alert(`Email successfully prepared for ${candidate.name}!`);
  };

  // Draft Response Email
  const handleDraftEmail = async (candidate) => {
    setIsDraftingId(candidate.id);
    const nextStep = getNextStepDetails(candidate.score, threshold);

    try {
      // Run offline draft email generator
      await new Promise(resolve => setTimeout(resolve, 100));
      const draftText = generateOfflineEmailDraft(candidate, nextStep, jobTitle);
      setEmailDrafts(prev => ({
        ...prev,
        [candidate.id]: draftText
      }));
    } catch (err) {
      alert(`Could not draft email: ${err.message}`);
    } finally {
      setIsDraftingId(null);
    }
  };

  // Copy Email Draft to Clipboard
  const handleCopyEmail = (id) => {
    const draft = emailDrafts[id];
    if (!draft) return;
    navigator.clipboard.writeText(draft);
    alert("Draft email copied to clipboard!");
  };

  // Determine Verdict and Action mapping
  const getNextStepDetails = (score, thresholdVal) => {
    if (score >= thresholdVal + 12) {
      return {
        title: "Fast-track to final interview",
        badge: "Shortlisted",
        badgeClass: "shortlisted",
        bannerClass: "action-banner shortlisted",
        reason: "Exceptional profile match. Bypassing initial assessments."
      };
    } else if (score >= thresholdVal) {
      return {
        title: "Advance to technical/first interview",
        badge: "Shortlisted",
        badgeClass: "shortlisted",
        bannerClass: "action-banner shortlisted",
        reason: "Meets or exceeds JD criteria. Proceed to technical screen."
      };
    } else if (score >= thresholdVal - 5) {
      return {
        title: "Recruiter phone screen",
        badge: "Borderline",
        badgeClass: "borderline",
        bannerClass: "action-banner borderline",
        reason: "Slight skill or context gaps. Clarify in a brief phone conversation."
      };
    } else if (score >= thresholdVal - 15) {
      return {
        title: "Hold in talent pool",
        badge: "Borderline",
        badgeClass: "borderline",
        bannerClass: "action-banner borderline",
        reason: "Valid skillset but pacing other candidates. Keep warm."
      };
    } else {
      return {
        title: "Decline with courtesy",
        badge: "Not a fit",
        badgeClass: "not-a-fit",
        bannerClass: "action-banner not-a-fit",
        reason: "Resume alignment score falls significantly below threshold."
      };
    }
  };

  // Statistics calculation for results panel
  const getResultsStatistics = () => {
    const screened = enrichedCandidates.filter(c => c.status === 'completed');
    let shortlisted = 0;
    let borderline = 0;
    let notFit = 0;

    screened.forEach(c => {
      const outcome = getNextStepDetails(c.score, threshold);
      if (outcome.badge === "Shortlisted") shortlisted++;
      else if (outcome.badge === "Borderline") borderline++;
      else notFit++;
    });

    return { shortlisted, borderline, notFit, total: screened.length };
  };

  const handleMoveStage = (candidateId, targetStage, rejectionReasonText = null) => {
    const candidate = enrichedCandidates.find(c => c.id === candidateId);
    if (!candidate) return;

    const timeStr = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedLog = [...(candidate.activityLog || [])];
    
    let logText = `Candidate stage moved to ${targetStage.toUpperCase()}`;
    if (targetStage === 'rejected' && rejectionReasonText) {
      logText += ` (Reason: ${rejectionReasonText})`;
    } else if (targetStage === 'hired') {
      logText = `🎉 Candidate stage marked as HIRED! Onboarding initiated.`;
    }
    
    updatedLog.push({
      id: updatedLog.length + 1,
      type: "stage_change",
      text: logText,
      timestamp: timeStr
    });

    updateCandidateJobData(candidateId, { 
      stage: targetStage,
      rejectionReason: rejectionReasonText || candidate.rejectionReason,
      evaluation: candidate.evaluation ? {
        ...candidate.evaluation,
        activity_log: updatedLog
      } : null,
      activityLog: updatedLog
    });

    if (targetStage === 'hired') {
      alert(`🎉 Congratulations! You have marked this candidate as HIRED. Onboarding timeline has been logged.`);
      return;
    }

    let templateId = 'interview_invitation';
    if (targetStage === 'interviewing') {
      templateId = 'interview_invitation';
    } else if (targetStage === 'offer') {
      templateId = 'offer_extended';
    } else if (targetStage === 'rejected') {
      templateId = 'decline_courtesy';
    } else if (targetStage === 'shortlisted') {
      const outcome = getNextStepDetails(getCandidateDisplayScore(candidate) || 70, threshold);
      templateId = outcome.badge === 'Shortlisted' ? 'interview_invitation' : 'phone_screen';
    } else {
      templateId = 'phone_screen';
    }

    setTimeout(() => {
      setSelectedTemplateId(templateId);
      setActiveEmailCandidateId(candidateId);
      setIsEmailModalOpen(true);
      setSendingStatus({ state: 'idle', progress: 0, activeName: '' });

      const template = emailTemplates.find(t => t.id === templateId) || emailTemplates[0];
      const subject = resolveTemplatePlaceholders(template.subject, candidate, jobTitle);
      const body = resolveTemplatePlaceholders(template.body, candidate, jobTitle);

      setEditedEmailDrafts(prev => ({
        ...prev,
        [candidateId]: { subject, body }
      }));
      setEditedEmailRecipients(prev => ({
        ...prev,
        [candidateId]: extractEmail(candidate)
      }));
    }, 100);
  };

  const handleExportCsv = () => {
    const selectedList = selectedCandidateIds.length > 0
      ? selectedCandidateIds.map(id => enrichedCandidates.find(c => c.id === id)).filter(Boolean)
      : enrichedCandidates.filter(c => c.status === 'completed');
      
    if (selectedList.length === 0) {
      alert("No completed candidates available to export.");
      return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Rank,Name,Email,ATS Match Score,Overall Score,Notice Period,Expected CTC,Current Location,Recruiter Note,Stage\r\n";
    
    selectedList.forEach((c, idx) => {
      const rank = idx + 1;
      const name = c.evaluation?.candidate_name || c.name;
      const email = extractEmail(c);
      const atsScore = c.score || 0;
      const finalScore = getCandidateDisplayScore(c) || 0;
      const np = c.evaluation?.notice_period || c.noticePeriod || "30 days";
      const expectedCtc = c.evaluation?.expected_ctc || c.expectedCtc || 0;
      const loc = c.evaluation?.location || c.location || "Bangalore";
      const note = (c.scorecard?.notes || "").replace(/"/g, '""');
      const stage = c.stage || "screening";
      
      csvContent += `${rank},"${name}","${email}",${atsScore},${finalScore},"${np}",${expectedCtc},"${loc}","${note}","${stage}"\r\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `RecruitPro_ATS_Candidates_Export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateCollaboratorScorecardField = (candidateId, collaborator, field, value) => {
    const candidate = enrichedCandidates.find(c => c.id === candidateId);
    if (!candidate) return;

    const ratings = candidate.collaboratorRatings || {
      recruiter: candidate.scorecard || { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "" },
      technical: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "" },
      hr: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "" }
    };
    
    const updatedCollaboratorCard = {
      ...ratings[collaborator],
      [field]: value
    };
    
    const updatedRatings = {
      ...ratings,
      [collaborator]: updatedCollaboratorCard
    };
    
    const updatedScorecard = updatedRatings.recruiter;
    
    const timeStr = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedLog = [...(candidate.activityLog || [])];
    
    let label = field === 'notes' ? `comments` : `rating for ${field} to ${value} stars`;
    updatedLog.push({
      id: updatedLog.length + 1,
      type: "scorecard_updated",
      text: `Collaborator [${collaborator.toUpperCase()}] updated ${label}`,
      timestamp: timeStr
    });

    updateCandidateJobData(candidateId, {
      scorecard: updatedScorecard,
      collaboratorRatings: updatedRatings,
      evaluation: candidate.evaluation ? {
        ...candidate.evaluation,
        scorecard: updatedScorecard,
        collaboratorRatings: updatedRatings,
        activity_log: updatedLog
      } : null,
      activityLog: updatedLog
    });
  };

  const updateScorecardField = (candidateId, field, value) => {
    updateCollaboratorScorecardField(candidateId, 'recruiter', field, value);
  };

  const handleScheduleInterview = (candidateId) => {
    if (!interviewDateTime) {
      alert("Please select a date and time for the interview.");
      return;
    }
    
    const candidate = enrichedCandidates.find(c => c.id === candidateId);
    if (!candidate) return;

    const timeStr = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedLog = [...(candidate.activityLog || [])];
    
    updatedLog.push({
      id: updatedLog.length + 1,
      type: "interview_scheduled",
      text: `📅 Interview Scheduled with ${interviewerName} on ${new Date(interviewDateTime).toLocaleString()} - Agenda: ${interviewAgenda}`,
      timestamp: timeStr
    });
    
    updateCandidateJobData(candidateId, {
      interview: {
        interviewer: interviewerName,
        dateTime: interviewDateTime,
        agenda: interviewAgenda
      },
      evaluation: candidate.evaluation ? {
        ...candidate.evaluation,
        activity_log: updatedLog
      } : null,
      activityLog: updatedLog
    });
    
    alert(`📅 Interview successfully scheduled with ${interviewerName}!`);
    setDrawerActiveTab('timeline'); // Switch to timeline view
  };

  const handleToggleResumeExpand = (id) => {
    setExpandedResumeIds(prev => 
      prev.includes(id) ? prev.filter(candId => candId !== id) : [...prev, id]
    );
  };

  const handleDragStart = (e, candidateId) => {
    e.dataTransfer.setData("candidateId", candidateId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDropStage = (e, targetStage) => {
    e.preventDefault();
    const candidateId = e.dataTransfer.getData("candidateId");
    if (!candidateId) return;
    
    handleMoveStage(candidateId, targetStage);
  };

  const handleTemplateChange = (templateId) => {
    setSelectedTemplateId(templateId);
    if (!activeEmailCandidateId) return;

    const candidate = candidates.find(c => c.id === activeEmailCandidateId);
    if (!candidate) return;

    const template = emailTemplates.find(t => t.id === templateId);
    if (!template) return;

    const subject = resolveTemplatePlaceholders(template.subject, candidate, jobTitle);
    const body = resolveTemplatePlaceholders(template.body, candidate, jobTitle);

    setEditedEmailDrafts(prev => ({
      ...prev,
      [activeEmailCandidateId]: { subject, body }
    }));
  };

  const renderKanbanBoard = () => {
    const stages = [
      { id: 'screening', name: 'Screening 📋', colorClass: 'borderline' },
      { id: 'shortlisted', name: 'Shortlisted 🎯', colorClass: 'shortlisted' },
      { id: 'interviewing', name: 'Interviewing 👥', colorClass: 'shortlisted' },
      { id: 'offer', name: 'Offer Extended ✉', colorClass: 'shortlisted' },
      { id: 'hired', name: 'Hired 🎉', colorClass: 'shortlisted' },
      { id: 'rejected', name: 'Declined ❌', colorClass: 'not-a-fit' }
    ];

    const completedScoredList = completedScoredCandidates;

    return (
      <div className="kanban-board animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem', overflowX: 'auto', minHeight: '500px' }}>
        {stages.map(stage => {
          const stageCandidates = completedScoredList.filter(c => c.stage === stage.id || (!c.stage && stage.id === 'screening'));
          
          return (
            <div 
              key={stage.id} 
              className={`kanban-column ${dragOverStage === stage.id ? 'drag-over' : ''}`}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--color-paper-darker)', borderRadius: 'var(--radius-md)', padding: '0.75rem', minWidth: '240px' }}
              onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.id); }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => { handleDropStage(e, stage.id); setDragOverStage(null); }}
            >
              <div className="kanban-column-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.50rem' }}>
                <span className={`kanban-column-title ${stage.colorClass}`} style={{ fontWeight: '800', fontSize: '0.82rem', textTransform: 'uppercase' }}>
                  {stage.name}
                </span>
                <span className="kanban-column-count" style={{ fontSize: '0.8rem', background: 'var(--color-border)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{stageCandidates.length}</span>
              </div>
              
              <div className="kanban-column-body scroll-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.50rem', flex: 1, overflowY: 'auto', maxHeight: '550px' }}>
                {stageCandidates.length === 0 ? (
                  <div className="kanban-empty-placeholder" style={{ padding: '2rem 1rem', border: '1px dashed var(--color-border)', borderRadius: '6px', textAlign: 'center', color: 'var(--color-ink-muted)', fontSize: '0.78rem' }}>
                    Drag candidates here
                  </div>
                ) : (
                  stageCandidates.map(candidate => {
                    const displayScore = getCandidateDisplayScore(candidate);
                    const outcome = getNextStepDetails(displayScore, threshold);
                    return (
                      <div 
                        key={candidate.id}
                        className="kanban-card"
                        draggable
                        onDragStart={(e) => handleDragStart(e, candidate.id)}
                        onClick={() => {
                          setDrawerActiveTab('overview');
                          setActiveDrawerCandidateId(candidate.id);
                        }}
                        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.75rem', backgroundColor: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: '6px', boxShadow: 'var(--shadow-sm)' }}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className="kanban-card-score" style={{ fontFamily: 'var(--font-mono)', fontWeight: '750', fontSize: '0.9rem', color: 'var(--color-terracotta)' }}>{displayScore}</span>
                          <span className={`candidate-verdict ${outcome.badgeClass}`} style={{ fontSize: '0.55rem', padding: '0.05rem 0.25rem' }}>
                            {outcome.badge}
                          </span>
                        </div>
                        <h4 className="kanban-card-name" style={{ margin: 0, fontSize: '0.85rem', fontWeight: '800' }}>{candidate.name}</h4>
                        <p className="kanban-card-filename text-xs text-muted" style={{ margin: 0, fontSize: '0.70rem' }}>📍 {candidate.evaluation?.location || candidate.location || 'Bangalore'} • {candidate.evaluation?.expected_ctc || candidate.expectedCtc}L</p>
                        
                        <div className="kanban-card-actions flex justify-between items-center" style={{ marginTop: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.35rem' }} onClick={(e) => e.stopPropagation()}>
                          <select 
                            className="text-xs" 
                            style={{ padding: '0.1rem 0.25rem', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'none', fontSize: '0.70rem' }}
                            value={candidate.stage || 'screening'}
                            onChange={(e) => handleMoveStage(candidate.id, e.target.value)}
                          >
                            <option value="screening">Screen</option>
                            <option value="shortlisted">Shortlist</option>
                            <option value="interviewing">Interview</option>
                            <option value="offer">Offer</option>
                            <option value="hired">Hired 🎉</option>
                            <option value="rejected">Decline</option>
                          </select>
                          
                          {sentEmails[candidate.id] && (
                            <span className="text-xs text-sage font-bold" style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', color: 'var(--color-sage)', fontSize: '0.70rem' }}>
                              <CheckCircle size={10} /> Sent
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderProfileDrawer = () => {
    if (!activeDrawerCandidateId) return null;
    const candidate = enrichedCandidates.find(c => c.id === activeDrawerCandidateId);
    if (!candidate) return null;
    
    const displayScore = getCandidateDisplayScore(candidate);
    const outcome = getNextStepDetails(displayScore, threshold);
    const evalData = candidate.evaluation || analyzeCandidateOffline(candidate, jobTitle, jobDescription, mustHaves);
    
    const isUnderBudget = (evalData.expected_ctc || candidate.expectedCtc || 0) <= 25;
    const isShortNotice = ['Immediate', '15 days', '30 days'].includes(evalData.notice_period || candidate.noticePeriod);
    
    return (
      <div className="drawer-backdrop animate-fade-in" onClick={() => setActiveDrawerCandidateId(null)}>
        <div className="drawer-content animate-slide-in-right" onClick={(e) => e.stopPropagation()}>
          <div className="drawer-header">
            <div className="flex justify-between items-start w-full">
              <div>
                <h2 className="drawer-candidate-name">{evalData.candidate_name || candidate.name}</h2>
                <p className="text-xs text-muted" style={{ fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                  {candidate.fileName} • {extractEmail(candidate)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-print-drawer btn-secondary"
                  onClick={() => window.print()}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', height: '32px', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'none', color: 'var(--color-ink-light)' }}
                  title="Print candidate scorecard report or save as PDF"
                >
                  🖨️ Export PDF
                </button>
                <button 
                  type="button" 
                  className="btn-close-drawer" 
                  onClick={() => setActiveDrawerCandidateId(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--color-ink)', padding: '0.25rem' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="drawer-tabs" style={{ display: 'flex', gap: '0.50rem', borderBottom: '1px solid var(--color-border)', marginTop: '1rem', paddingBottom: '0.15rem' }}>
              <button 
                type="button" 
                className={`drawer-tab-btn ${drawerActiveTab === 'overview' ? 'active' : ''}`}
                onClick={() => setDrawerActiveTab('overview')}
                style={{ background: 'none', border: 'none', borderBottom: drawerActiveTab === 'overview' ? '2px solid var(--color-terracotta)' : 'none', color: drawerActiveTab === 'overview' ? 'var(--color-terracotta)' : 'var(--color-ink-muted)', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: drawerActiveTab === 'overview' ? 'bold' : 'normal', fontSize: '0.85rem' }}
              >
                Overview
              </button>
              <button 
                type="button" 
                className={`drawer-tab-btn ${drawerActiveTab === 'resume' ? 'active' : ''}`}
                onClick={() => setDrawerActiveTab('resume')}
                style={{ background: 'none', border: 'none', borderBottom: drawerActiveTab === 'resume' ? '2px solid var(--color-terracotta)' : 'none', color: drawerActiveTab === 'resume' ? 'var(--color-terracotta)' : 'var(--color-ink-muted)', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: drawerActiveTab === 'resume' ? 'bold' : 'normal', fontSize: '0.85rem' }}
              >
                Resume Text
              </button>
              <button 
                type="button" 
                className={`drawer-tab-btn ${drawerActiveTab === 'scorecard' ? 'active' : ''}`}
                onClick={() => setDrawerActiveTab('scorecard')}
                style={{ background: 'none', border: 'none', borderBottom: drawerActiveTab === 'scorecard' ? '2px solid var(--color-terracotta)' : 'none', color: drawerActiveTab === 'scorecard' ? 'var(--color-terracotta)' : 'var(--color-ink-muted)', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: drawerActiveTab === 'scorecard' ? 'bold' : 'normal', fontSize: '0.85rem' }}
              >
                Evaluate & Stars
              </button>
              <button 
                type="button" 
                className={`drawer-tab-btn ${drawerActiveTab === 'scheduler' ? 'active' : ''}`}
                onClick={() => setDrawerActiveTab('scheduler')}
                style={{ background: 'none', border: 'none', borderBottom: drawerActiveTab === 'scheduler' ? '2px solid var(--color-terracotta)' : 'none', color: drawerActiveTab === 'scheduler' ? 'var(--color-terracotta)' : 'var(--color-ink-muted)', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: drawerActiveTab === 'scheduler' ? 'bold' : 'normal', fontSize: '0.85rem' }}
              >
                Schedule Interview
              </button>
              <button 
                type="button" 
                className={`drawer-tab-btn ${drawerActiveTab === 'timeline' ? 'active' : ''}`}
                onClick={() => setDrawerActiveTab('timeline')}
                style={{ background: 'none', border: 'none', borderBottom: drawerActiveTab === 'timeline' ? '2px solid var(--color-terracotta)' : 'none', color: drawerActiveTab === 'timeline' ? 'var(--color-terracotta)' : 'var(--color-ink-muted)', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: drawerActiveTab === 'timeline' ? 'bold' : 'normal', fontSize: '0.85rem' }}
              >
                Timeline Log ({(evalData.activity_log || candidate.activityLog || []).length})
              </button>
            </div>
          </div>
          
          <div className="drawer-body scroll-container" style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {drawerActiveTab === 'overview' && (
              <div className="drawer-tab-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'var(--color-paper-light)' }}>
                    <span className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: '700' }}>Overall Score</span>
                    <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.25rem 0' }}>
                      <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                        <circle
                          cx="40"
                          cy="40"
                          r="32"
                          stroke="var(--color-border)"
                          strokeWidth="6"
                          fill="transparent"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="32"
                          stroke={(displayScore || 0) >= 80 ? 'var(--color-sage)' : (displayScore || 0) >= 70 ? 'var(--color-gold)' : 'var(--color-terracotta)'}
                          strokeWidth="6"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 32}
                          strokeDashoffset={2 * Math.PI * 32 - (2 * Math.PI * 32 * (displayScore || 0)) / 100}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                        />
                      </svg>
                      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--color-ink)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{displayScore}</span>
                      </div>
                    </div>
                    <span className={`candidate-verdict ${outcome.badgeClass}`} style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}>
                      {outcome.badge} Match
                    </span>
                  </div>
                  
                  <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', backgroundColor: 'var(--color-paper-light)' }}>
                    <span className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: '700' }}>Resume Quality</span>
                    <div style={{ fontSize: '2.25rem', fontWeight: '800', color: 'var(--color-sage)', fontFamily: 'var(--font-mono)' }}>{evalData.resume_quality || candidate.resumeQuality || 85}%</div>
                    <span className="text-xs text-muted">ATS Structure Analysis</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.50rem', flexWrap: 'wrap' }}>
                  {isUnderBudget ? (
                    <span className="candidate-verdict shortlisted" style={{ textTransform: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem' }}>
                      <CheckCircle size={12} /> Under Budget (Budget: 25 LPA)
                    </span>
                  ) : (
                    <span className="candidate-verdict borderline" style={{ textTransform: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem' }}>
                      <AlertTriangle size={12} /> Exceeds Ideal 25 LPA Limit
                    </span>
                  )}
                  {isShortNotice ? (
                    <span className="candidate-verdict shortlisted" style={{ textTransform: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem' }}>
                      <CheckCircle size={12} /> Fast Joiner ({evalData.notice_period || candidate.noticePeriod})
                    </span>
                  ) : (
                    <span className="candidate-verdict not-a-fit" style={{ textTransform: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem' }}>
                      <AlertCircle size={12} /> Notice: {evalData.notice_period || candidate.noticePeriod}
                    </span>
                  )}
                  {candidate.interview && (
                    <span className="candidate-verdict shortlisted" style={{ textTransform: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', backgroundColor: 'var(--color-gold-light)', color: 'var(--color-gold)', borderColor: 'rgba(192, 154, 85, 0.2)' }}>
                      📅 Interview Scheduled
                    </span>
                  )}
                  {candidate.stage === 'hired' && (
                    <span className="candidate-verdict shortlisted" style={{ textTransform: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', backgroundColor: 'var(--color-sage-light)', color: 'var(--color-sage)' }}>
                      🎉 Hired Candidate
                    </span>
                  )}
                </div>

                <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--color-white)' }}>
                  <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.75rem', color: 'var(--color-ink-muted)' }}>Screening Metrics</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.35rem' }}>
                      <span className="text-muted">Notice Period:</span>
                      <strong className="mono-font">{evalData.notice_period || candidate.noticePeriod}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.35rem' }}>
                      <span className="text-muted">Current CTC:</span>
                      <strong className="mono-font">{evalData.current_ctc || candidate.currentCtc} LPA</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.35rem' }}>
                      <span className="text-muted">Expected CTC:</span>
                      <strong className="mono-font" style={{ color: 'var(--color-terracotta)' }}>{evalData.expected_ctc || candidate.expectedCtc} LPA</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.35rem' }}>
                      <span className="text-muted">Location:</span>
                      <strong>{evalData.location || candidate.location}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.35rem' }}>
                      <span className="text-muted">Preferred Location:</span>
                      <strong>{evalData.preferred_location || candidate.preferredLocation}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.35rem' }}>
                      <span className="text-muted">Pipeline Stage:</span>
                      <strong className="mono-font text-capitalize" style={{ color: 'var(--color-terracotta)' }}>{candidate.stage || 'screening'}</strong>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '1rem' }}>
                  <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.75rem', color: 'var(--color-ink-muted)' }}>Score Card Dimensions</h4>
                  <div className="subscores-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem 1.25rem' }}>
                    {Object.entries(evalData.subscores || {}).map(([key, val]) => (
                      <div className="subscore-item" key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div className="subscore-label-val" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '600' }}>
                          <span className="text-capitalize">{key}</span>
                          <span className="subscore-val">{val}</span>
                        </div>
                        <div className="progress-bar-bg">
                          <div className="progress-bar-fill" style={{ width: `${val}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="card" style={{ padding: '1rem' }}>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--color-sage)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle size={12} /> Strengths
                    </h4>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', listStyle: 'none', paddingLeft: 0 }}>
                      {evalData.strengths?.slice(0, 3).map((str, idx) => (
                        <li key={idx} style={{ fontSize: '0.78rem', display: 'flex', gap: '0.25rem', alignItems: 'flex-start', color: 'var(--color-ink-light)' }}>
                          <span style={{ color: 'var(--color-sage)' }}>✓</span> <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="card" style={{ padding: '1rem' }}>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--color-red)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <AlertTriangle size={12} /> Areas to Probe
                    </h4>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', listStyle: 'none', paddingLeft: 0 }}>
                      {evalData.risks?.slice(0, 3).map((risk, idx) => (
                        <li key={idx} style={{ fontSize: '0.78rem', display: 'flex', gap: '0.25rem', alignItems: 'flex-start', color: 'var(--color-ink-light)' }}>
                          <span style={{ color: 'var(--color-red)' }}>⚠</span> <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* AI Interview Guide Widget */}
                <div className="card ai-interview-guide-card" style={{ padding: '1.25rem', backgroundColor: 'var(--color-paper-light)', border: '1px solid rgba(200,90,50,0.15)', boxShadow: 'var(--shadow-sm)' }}>
                  <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', marginBottom: '0.75rem', color: 'var(--color-terracotta)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: '800' }}>
                    <Sparkles size={14} style={{ color: 'var(--color-terracotta)' }} /> AI Tailored Interview Guide
                  </h4>
                  <p className="text-xs text-muted" style={{ marginBottom: '1rem' }}>Customized probing questions based on automated ATS skill gap analysis.</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {(evalData.interview_questions || []).map((item, idx) => (
                      <div key={idx} className="ai-question-box" style={{ backgroundColor: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '750', textTransform: 'uppercase', color: 'var(--color-terracotta)', fontFamily: 'var(--font-mono)' }}>
                            {item.type}
                          </span>
                          <span className="keyword-chip matched" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                            Focus: {item.skill}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--color-ink-light)', fontStyle: 'italic', margin: 0 }}>
                          "{item.question}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {drawerActiveTab === 'resume' && (
              <div className="drawer-tab-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card" style={{ padding: '1rem' }}>
                  <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--color-ink-muted)' }}>Resume Extracted Text</h4>
                  <p className="text-xs text-muted" style={{ marginBottom: '1rem' }}>Matched skills are highlighted in green matching keywords. Scroll to examine.</p>
                  <div className="resume-text-box" style={{ backgroundColor: 'var(--color-paper-light)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '1.25rem', maxHeight: '420px', overflowY: 'auto' }}>
                    <pre style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--color-ink-light)', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                      {getHighlightedText(candidate.text, evalData.matched_keywords)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
            
            {drawerActiveTab === 'scorecard' && (() => {
              const ratings = candidate.collaboratorRatings || {
                recruiter: candidate.scorecard || { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "" },
                technical: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "" },
                hr: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "" }
              };
              
              const activeCard = ratings[activeCollaborator] || { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "" };
              
              const renderStarSelector = (field, label) => {
                const val = activeCard[field] || 3;
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{label}</span>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          className="collaborator-star-btn"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1.4rem',
                            color: star <= val ? 'var(--color-gold)' : 'var(--color-border-hover)',
                            padding: '0 0.1rem',
                            transition: 'transform 0.1s'
                          }}
                          onClick={() => updateCollaboratorScorecardField(candidate.id, activeCollaborator, field, star)}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                );
              };
              
              return (
                <div className="drawer-tab-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                    {[
                      { id: 'recruiter', name: 'Recruiter Screen 📋' },
                      { id: 'technical', name: 'Technical Interviewer 💻' },
                      { id: 'hr', name: 'HR Manager 👥' }
                    ].map(col => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => setActiveCollaborator(col.id)}
                        style={{
                          background: activeCollaborator === col.id ? 'var(--color-terracotta-light)' : 'none',
                          border: '1px solid ' + (activeCollaborator === col.id ? 'var(--color-terracotta)' : 'var(--color-border)'),
                          borderRadius: '4px',
                          color: activeCollaborator === col.id ? 'var(--color-terracotta)' : 'var(--color-ink-light)',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          fontWeight: activeCollaborator === col.id ? 'bold' : 'normal'
                        }}
                      >
                        {col.name}
                      </button>
                    ))}
                  </div>

                  <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
                      Evaluating as: <span style={{ color: 'var(--color-terracotta)', fontWeight: 'bold' }}>{activeCollaborator.toUpperCase()}</span>
                    </h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {renderStarSelector("technical", "Technical Capabilities")}
                      {renderStarSelector("communication", "Communication Skills")}
                      {renderStarSelector("problemSolving", "Problem Solving & Logic")}
                      {renderStarSelector("cultureFit", "Cultural Fit Alignment")}
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: 0, marginTop: '0.5rem' }}>
                      <label className="form-label">Review remarks ({activeCollaborator})</label>
                      <textarea
                        className="input-textarea"
                        style={{ minHeight: '120px', fontSize: '0.85rem' }}
                        placeholder={`Write feedback comments for ${activeCollaborator} stage...`}
                        value={activeCard.notes || ''}
                        onChange={(e) => updateCollaboratorScorecardField(candidate.id, activeCollaborator, 'notes', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {drawerActiveTab === 'scheduler' && (
              <div className="drawer-tab-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>Schedule Panel Interview</h4>
                  
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label text-xs">Interviewer Name</label>
                    <input
                      type="text"
                      className="input-text text-sm"
                      value={interviewerName}
                      onChange={(e) => setInterviewerName(e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label text-xs">Date & Time</label>
                    <input
                      type="datetime-local"
                      className="input-text text-sm"
                      value={interviewDateTime}
                      onChange={(e) => setInterviewDateTime(e.target.value)}
                      style={{ color: 'var(--color-ink)' }}
                    />
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label text-xs">Agenda Description</label>
                    <textarea
                      className="input-textarea text-sm"
                      style={{ minHeight: '60px' }}
                      value={interviewAgenda}
                      onChange={(e) => setInterviewAgenda(e.target.value)}
                    />
                  </div>
                  
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleScheduleInterview(candidate.id)}
                    style={{ backgroundColor: 'var(--color-sage)', background: 'linear-gradient(135deg, var(--color-sage), var(--color-sage-hover))', boxShadow: 'none', marginTop: '0.5rem' }}
                  >
                    Confirm Scheduling
                  </button>
                </div>
              </div>
            )}
            
            {drawerActiveTab === 'timeline' && (
              <div className="drawer-tab-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Manual Note Logger Widget */}
                <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>Log New Activity / Note</h4>
                  
                  <div style={{ display: 'flex', gap: '0.50rem', flexWrap: 'wrap' }}>
                    {['Recruiter Note', 'Phone Call', 'Tech Assessment', 'HR Feedback'].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewNoteCategory(cat)}
                        style={{
                          background: newNoteCategory === cat ? 'var(--color-terracotta-light)' : 'none',
                          border: '1px solid ' + (newNoteCategory === cat ? 'var(--color-terracotta)' : 'var(--color-border)'),
                          borderRadius: '4px',
                          color: newNoteCategory === cat ? 'var(--color-terracotta)' : 'var(--color-ink-light)',
                          padding: '0.25rem 0.60rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          fontWeight: newNoteCategory === cat ? 'bold' : 'normal'
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <textarea
                      className="input-textarea text-xs"
                      style={{ minHeight: '80px', padding: '0.50rem', fontSize: '0.8rem' }}
                      placeholder={`Enter notes for ${newNoteCategory}...`}
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                    />
                  </div>
                  
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ alignSelf: 'flex-end', width: 'auto', padding: '0.45rem 1.25rem', fontSize: '0.8rem' }}
                    onClick={() => handleAddTimelineActivity(candidate.id)}
                    disabled={!newNoteText.trim()}
                  >
                    Post Activity Note
                  </button>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem', color: 'var(--color-ink-muted)' }}>Candidate Activity Trail</h4>
                  
                  <div className="timeline-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', paddingLeft: '1.5rem' }}>
                    <div style={{ position: 'absolute', left: '6px', top: '4px', bottom: '4px', width: '2px', background: 'var(--color-border)' }}></div>
                    
                    {(evalData.activity_log || candidate.activityLog || []).slice().reverse().map((log, idx) => (
                      <div key={log.id || idx} style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '-29px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: log.type === 'stage_change' ? 'var(--color-terracotta)' : log.type === 'interview_scheduled' ? 'var(--color-gold)' : log.type === 'note' ? 'var(--color-ink-light)' : 'var(--color-sage)', border: '2px solid var(--color-white)' }}></div>
                        <div style={{ fontSize: '0.82rem', fontWeight: '600' }}>{log.text}</div>
                        <div style={{ fontSize: '0.70rem', color: 'var(--color-ink-muted)', marginTop: '0.15rem' }}>{log.timestamp}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="drawer-footer" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-paper-light)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="text-xs text-muted font-bold uppercase" style={{ fontSize: '0.7rem' }}>Update Status:</span>
              <select
                className="input-text text-sm"
                style={{ padding: '0.3rem 0.5rem', height: 'auto', border: '1px solid var(--color-border)', width: 'auto', display: 'inline-block' }}
                value={candidate.stage || 'screening'}
                onChange={(e) => handleMoveStage(candidate.id, e.target.value)}
              >
                <option value="screening">Screening</option>
                <option value="shortlisted">Shortlist</option>
                <option value="interviewing">Interview</option>
                <option value="offer">Offer Extended</option>
                <option value="hired">Hired 🎉</option>
                <option value="rejected">Decline</option>
              </select>
            </div>
            
            <button 
              type="button" 
              className="btn-primary" 
              style={{ width: 'auto', padding: '0.45rem 1.5rem', backgroundColor: 'var(--color-ink)', background: 'var(--color-ink)', boxShadow: 'none' }}
              onClick={() => setActiveDrawerCandidateId(null)}
            >
              Close Profile
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAnalyticsDashboard = () => {
    const scored = candidates.filter(c => c.status === 'completed');
    if (scored.length === 0) {
      return (
        <div className="card text-center" style={{ padding: '4rem 2rem' }}>
          <h3>No Scored Candidates Available for Analytics</h3>
        </div>
      );
    }
    
    let excellent = 0, good = 0, borderline = 0, unfit = 0;
    scored.forEach(c => {
      const s = getCandidateDisplayScore(c) || 0;
      if (s >= 80) excellent++;
      else if (s >= 70) good++;
      else if (s >= 60) borderline++;
      else unfit++;
    });
    
    const noticeCounts = { 'Immediate': 0, '15 days': 0, '30 days': 0, '60 days': 0, '90 days': 0 };
    scored.forEach(c => {
      const np = c.evaluation?.notice_period || c.noticePeriod || '15 days';
      if (noticeCounts[np] !== undefined) noticeCounts[np]++;
      else noticeCounts['30 days']++;
    });
    
    const locationCounts = {};
    scored.forEach(c => {
      const loc = c.evaluation?.location || c.location || 'Unknown';
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });
    
    const budgetLimit = 25;
    let underBudget = 0, overBudget = 0;
    scored.forEach(c => {
      const expected = c.evaluation?.expected_ctc || c.expectedCtc || 0;
      if (expected <= budgetLimit) underBudget++;
      else overBudget++;
    });
    
    return (
      <div className="analytics-grid animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card" style={{ padding: '1.5rem', gridColumn: 'span 2' }}>
          <h3 style={{ fontSize: '1.1rem', textTransform: 'uppercase', marginBottom: '1.25rem', color: 'var(--color-ink-muted)' }}>Match Score Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { label: '🔥 Excellent Fit (80-100)', count: excellent, color: 'var(--color-sage)' },
              { label: '🎯 Good Match (70-79)', count: good, color: 'var(--color-gold)' },
              { label: '⚖ Borderline (60-69)', count: borderline, color: 'var(--color-terracotta)' },
              { label: '❌ Unfit (<60)', count: unfit, color: 'var(--color-red)' }
            ].map((bracket, idx) => {
              const pct = scored.length ? Math.round((bracket.count / scored.length) * 100) : 0;
              return (
                <div key={idx} className="bar-chart-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className="bar-chart-label" style={{ width: '200px', fontSize: '0.85rem', fontWeight: '600' }}>{bracket.label}</span>
                  <div className="progress-bar-bg" style={{ flex: 1, height: '14px', borderRadius: '7px' }}>
                    <div className="progress-bar-fill" style={{ width: `${pct}%`, height: '100%', background: bracket.color, borderRadius: '7px' }} />
                  </div>
                  <span className="bar-chart-value" style={{ width: '80px', fontSize: '0.85rem', fontWeight: 'bold', textAlign: 'right' }}>
                    {bracket.count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', textTransform: 'uppercase', marginBottom: '1.25rem', color: 'var(--color-ink-muted)' }}>Budget Compliance (Budget: 25 LPA)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', minHeight: '180px' }}>
            <div style={{ display: 'flex', gap: '2rem', width: '100%', justifyContent: 'space-around' }}>
              <div style={{ textAlign: 'center' }}>
                <span className="text-xs text-muted" style={{ display: 'block', textTransform: 'uppercase' }}>Within Budget</span>
                <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--color-sage)' }}>{underBudget}</span>
                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-ink-muted)' }}>candidates</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span className="text-xs text-muted" style={{ display: 'block', textTransform: 'uppercase' }}>Exceeds Budget</span>
                <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--color-red)' }}>{overBudget}</span>
                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-ink-muted)' }}>candidates</span>
              </div>
            </div>
            <div className="progress-bar-bg" style={{ width: '100%', height: '10px', borderRadius: '5px' }}>
              <div className="progress-bar-fill" style={{ width: `${scored.length ? Math.round((underBudget / scored.length) * 100) : 0}%`, height: '100%', background: 'var(--color-sage)', borderRadius: '5px' }} />
            </div>
            <span className="text-xs text-muted">
              {scored.length ? Math.round((underBudget / scored.length) * 100) : 0}% of candidates are aligned with salary budget limits.
            </span>
          </div>
        </div>
        
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', textTransform: 'uppercase', marginBottom: '1.25rem', color: 'var(--color-ink-muted)' }}>Notice Period Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(noticeCounts).map(([np, count]) => {
              const pct = scored.length ? Math.round((count / scored.length) * 100) : 0;
              return (
                <div key={np} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ width: '100px', fontSize: '0.85rem', fontWeight: '600' }}>{np}</span>
                  <div className="progress-bar-bg" style={{ flex: 1, height: '8px' }}>
                    <div className="progress-bar-fill" style={{ width: `${pct}%`, height: '100%', background: 'var(--color-terracotta)' }} />
                  </div>
                  <span className="mono-font" style={{ width: '60px', fontSize: '0.85rem', textAlign: 'right', fontWeight: 'bold' }}>{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="card" style={{ padding: '1.5rem', gridColumn: 'span 2' }}>
          <h3 style={{ fontSize: '1.1rem', textTransform: 'uppercase', marginBottom: '1.25rem', color: 'var(--color-ink-muted)' }}>Location Distribution</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {Object.entries(locationCounts).map(([loc, count]) => {
              return (
                <div key={loc} style={{ background: 'var(--color-paper-light)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1.25rem', minWidth: '120px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span className="text-xs text-muted" style={{ fontWeight: 'bold' }}>{loc}</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-terracotta)' }}>{count}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>{count === 1 ? 'candidate' : 'candidates'}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderCreateJobModal = () => {
    if (!isJobModalOpen) return null;

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!newJobTitle.trim() || !newJobDesc.trim()) {
        alert("Please enter a job title and description.");
        return;
      }
      const newJobId = `job-${Date.now()}`;
      const newJob = {
        id: newJobId,
        title: newJobTitle.trim(),
        description: newJobDesc.trim(),
        mustHaves: newJobMustHaves.trim()
      };

      setJobs(prev => [...prev, newJob]);
      setActiveJobId(newJobId);
      setJobTitle(newJob.title);
      setJobDescription(newJob.description);
      setMustHaves(newJob.mustHaves);
      
      // Reset form
      setNewJobTitle('');
      setNewJobDesc('');
      setNewJobMustHaves('');
      setIsJobModalOpen(false);
    };

    return (
      <div className="modal-backdrop">
        <div className="modal-content" style={{ maxWidth: '500px' }}>
          <div className="modal-header">
            <h3 className="modal-title">Create New Job Opening</h3>
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => {
                setIsJobModalOpen(false);
                setNewJobTitle('');
                setNewJobDesc('');
                setNewJobMustHaves('');
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-light)' }}
            >
              <X size={18} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label text-xs">Job Title</label>
                <input 
                  type="text" 
                  className="input-text text-sm" 
                  placeholder="e.g. Senior Data Engineer"
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label text-xs">Job Description</label>
                <textarea 
                  className="input-textarea text-sm" 
                  style={{ minHeight: '120px' }}
                  placeholder="Paste details about the responsibilities and requirements..."
                  value={newJobDesc}
                  onChange={(e) => setNewJobDesc(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label text-xs">Must-Haves / Skills (comma separated)</label>
                <textarea 
                  className="input-textarea text-sm" 
                  style={{ minHeight: '80px' }}
                  placeholder="e.g. Python, SQL, ETL, Spark, AWS"
                  value={newJobMustHaves}
                  onChange={(e) => setNewJobMustHaves(e.target.value)}
                />
              </div>
            </div>
            
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => {
                  setIsJobModalOpen(false);
                  setNewJobTitle('');
                  setNewJobDesc('');
                  setNewJobMustHaves('');
                }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: 'auto', padding: '0.6rem 1.5rem' }}
              >
                Create Job
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderSupabaseModal = () => {
    if (!isSupabaseModalOpen) return null;

    const sqlScript = `-- SQL DDL setup for RecruitPro ATS
-- Paste this script into your Supabase SQL Editor (https://supabase.com/dashboard/project/hqtpxaeuhsovwhevztzi/sql/new)

CREATE TABLE IF NOT EXISTS public.jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  "mustHaves" TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.jobs DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.candidates (
  id TEXT PRIMARY KEY,
  name TEXT,
  "fileName" TEXT,
  "fileSize" INTEGER,
  status TEXT,
  "ocrProgress" INTEGER,
  text TEXT,
  "numChars" INTEGER,
  "errorDetails" TEXT,
  score INTEGER,
  stage TEXT,
  "noticePeriod" TEXT,
  "currentCtc" NUMERIC,
  "expectedCtc" NUMERIC,
  location TEXT,
  "preferredLocation" TEXT,
  "resumeQuality" INTEGER,
  evaluation JSONB,
  scorecard JSONB,
  "activityLog" JSONB,
  "jobsData" JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.candidates DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.email_templates (
  id TEXT PRIMARY KEY,
  name TEXT,
  subject TEXT,
  body TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.email_templates DISABLE ROW LEVEL SECURITY;`;

    const copySqlToClipboard = () => {
      navigator.clipboard.writeText(sqlScript);
      alert("📋 SQL Schema copied to clipboard!");
    };

    return (
      <div className="modal-backdrop">
        <div className="modal-content" style={{ maxWidth: '650px', width: '95%' }}>
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>⚡</span>
              <h3 className="modal-title">Supabase Database Integration</h3>
            </div>
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setIsSupabaseModalOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-light)' }}
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '70vh', overflowY: 'auto', padding: '1rem 0' }}>
            {/* Status Panel */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '1rem', 
              borderRadius: 'var(--radius-sm)', 
              background: 'var(--color-paper-darker)',
              border: '1px solid var(--color-border)'
            }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>Connection Status</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                  <span className={`dot ${supabaseStatus === 'connected' ? 'active' : supabaseStatus === 'schema_missing' ? 'warning' : 'error'}`} style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    display: 'inline-block',
                    backgroundColor: supabaseStatus === 'connected' ? 'var(--color-sage)' : supabaseStatus === 'schema_missing' ? 'orange' : 'var(--color-red)'
                  }}></span>
                  <span style={{ textTransform: 'capitalize', fontWeight: '600', fontSize: '0.85rem' }}>
                    {supabaseStatus === 'connected' && 'Connected (Live Data Sync)'}
                    {supabaseStatus === 'schema_missing' && 'Tables Missing'}
                    {supabaseStatus === 'connecting' && 'Connecting...'}
                    {supabaseStatus === 'error' && 'Connection Error'}
                    {supabaseStatus === 'offline' && 'Offline Fallback'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => verifySupabaseConnection(true)}
                  disabled={supabaseStatus === 'connecting'}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                >
                  <RefreshCw size={12} className={supabaseStatus === 'connecting' ? 'spinner' : ''} />
                  Verify Connection
                </button>
                {supabaseStatus === 'connected' && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={seedSupabase}
                    disabled={isSeeding}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                  >
                    {isSeeding ? 'Seeding...' : 'Reset & Seed Demo Data'}
                  </button>
                )}
              </div>
            </div>

            {/* Error Message */}
            {supabaseError && (
              <div style={{ 
                padding: '0.75rem 1rem', 
                borderRadius: 'var(--radius-sm)', 
                background: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: 'var(--color-red)',
                fontSize: '0.8rem'
              }}>
                <strong>Error:</strong> {supabaseError}
              </div>
            )}

            {/* Credentials details */}
            <div>
              <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--color-ink-muted)', textTransform: 'uppercase' }}>Project URL</label>
              <input 
                type="text" 
                readOnly 
                className="input-text text-sm" 
                style={{ background: 'var(--color-paper-darker)', color: 'var(--color-ink-muted)', cursor: 'default' }}
                value="https://hqtpxaeuhsovwhevztzi.supabase.co" 
              />
            </div>

            {/* Schema Missing Alert */}
            {supabaseStatus === 'schema_missing' && (
              <div style={{ 
                padding: '1rem', 
                borderRadius: 'var(--radius-sm)', 
                background: 'rgba(245, 158, 11, 0.1)', 
                border: '1px solid rgba(245, 158, 11, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '700', color: 'darkorange' }}>
                  <AlertTriangle size={16} />
                  <span>Setup Action Required</span>
                </div>
                <p style={{ fontSize: '0.8rem', margin: 0, color: 'var(--color-ink-muted)' }}>
                  The client has successfully authenticated but did not find the required tables: <code>jobs</code>, <code>candidates</code>, or <code>email_templates</code>.
                </p>
                <p style={{ fontSize: '0.8rem', margin: 0, color: 'var(--color-ink-muted)' }}>
                  Please copy the SQL schema script below, navigate to your <strong>Supabase SQL Editor</strong>, paste and run it, then click <strong>Verify Connection</strong>.
                </p>
              </div>
            )}

            {/* DDL Code Block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--color-ink-muted)', textTransform: 'uppercase' }}>Database SQL Setup (DDL)</span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={copySqlToClipboard}
                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Copy size={11} />
                  Copy SQL
                </button>
              </div>
              <pre style={{ 
                background: 'var(--color-code-bg, #1e1e1e)', 
                color: '#d4d4d4', 
                padding: '1rem', 
                borderRadius: 'var(--radius-sm)', 
                fontFamily: 'monospace', 
                fontSize: '0.75rem',
                overflowX: 'auto',
                border: '1px solid var(--color-border)',
                maxHeight: '220px'
              }}>
                {sqlScript}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCareersPreviewModal = () => {
    if (!isCareersPreviewOpen) return null;
    
    const skillsList = mustHaves ? mustHaves.split(',').map(s => s.trim()).filter(Boolean) : ['React', 'TypeScript', 'Sass'];
    
    const handleMockSubmit = (e) => {
      e.preventDefault();
      if (!appFormName || !appFormEmail || !appFormResume) {
        alert("Please fill in all fields.");
        return;
      }
      
      const candidateId = Math.random().toString(36).substring(7);
      const newCandidate = {
        id: candidateId,
        name: appFormName,
        fileName: 'Careers_Portal_Submission.txt',
        fileSize: appFormResume.length,
        status: 'ready',
        ocrProgress: 0,
        text: `${appFormName}\nEmail: ${appFormEmail}\n\nResume Details:\n${appFormResume}`,
        numChars: appFormResume.length,
        errorDetails: '',
        score: null,
        evaluation: null,
        stage: 'screening',
        activityLog: [
          { id: 1, type: "applied", text: "Candidate applied directly via public careers portal", timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ]
      };
      
      setCandidates(prev => [...prev, newCandidate]);
      setAppSubmitted(true);
      setTimeout(() => {
        setAppFormName('');
        setAppFormEmail('');
        setAppFormResume('');
        setAppSubmitted(false);
        setIsCareersPreviewOpen(false);
        alert(`🎉 Application submitted! ${appFormName} has been added to your screening queue.`);
      }, 1500);
    };
    
    return (
      <div className="modal-backdrop">
        <div className="modal-content careers-preview-modal" style={{ width: '950px', maxWidth: '95vw', height: '650px', maxHeight: '90vh', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="careers-header" style={{ background: 'linear-gradient(135deg, #1E293B, #0F172A)', color: '#F8FAFC', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="text-xs" style={{ textTransform: 'uppercase', color: 'var(--color-terracotta)', fontWeight: 'bold' }}>Live Careers Page Preview</span>
              <h3 style={{ color: '#F8FAFC', fontSize: '1.25rem', margin: 0 }}>Acme Corp Jobs Portal</h3>
            </div>
            <button 
              type="button" 
              onClick={() => setIsCareersPreviewOpen(false)}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#FFF', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Left Side: Customizer Controls */}
            <div className="careers-customizer-sidebar" style={{ width: '250px', borderRight: '1px solid var(--color-border)', backgroundColor: 'var(--color-paper-darker)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
              <span style={{ fontWeight: '800', fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>Site Styles Customizer</span>
              
              {/* Theme Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="form-label text-xs">Color Scheme</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {[
                    { id: 'indigo', name: 'Indigo Corporate 🔵', color: '#4F46E5' },
                    { id: 'emerald', name: 'Emerald Creative 🟢', color: '#10B981' },
                    { id: 'terracotta', name: 'Terracotta Warm 🟤', color: '#C85A32' }
                  ].map(thm => (
                    <button
                      key={thm.id}
                      type="button"
                      onClick={() => setCareersTheme(thm.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid ' + (careersTheme === thm.id ? thm.color : 'var(--color-border)'),
                        borderRadius: '6px',
                        background: careersTheme === thm.id ? 'var(--color-white)' : 'none',
                        color: 'var(--color-ink)',
                        cursor: 'pointer',
                        fontWeight: careersTheme === thm.id ? 'bold' : 'normal',
                        fontSize: '0.8rem',
                        textAlign: 'left'
                      }}
                    >
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: thm.color, display: 'inline-block' }} />
                      {thm.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="form-label text-xs">Typography Font</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {[
                    { id: 'sans', name: 'Modern Sans-Serif', family: 'var(--font-body)' },
                    { id: 'serif', name: 'Elegant Serif', family: 'var(--font-display)' },
                    { id: 'mono', name: 'Technical Monospace', family: 'var(--font-mono)' }
                  ].map(fnt => (
                    <button
                      key={fnt.id}
                      type="button"
                      onClick={() => setCareersFont(fnt.id)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        border: '1px solid ' + (careersFont === fnt.id ? 'var(--color-terracotta)' : 'var(--color-border)'),
                        borderRadius: '6px',
                        background: careersFont === fnt.id ? 'var(--color-white)' : 'none',
                        color: 'var(--color-ink)',
                        cursor: 'pointer',
                        fontWeight: careersFont === fnt.id ? 'bold' : 'normal',
                        fontSize: '0.8rem',
                        fontFamily: fnt.family,
                        textAlign: 'left'
                      }}
                    >
                      {fnt.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Side: Active Careers Site */}
            {(() => {
              let primaryColor = '#4F46E5';
              let hoverColor = '#4338CA';
              let lightColor = '#EEF2F6';
              
              if (careersTheme === 'emerald') {
                primaryColor = '#10B981';
                hoverColor = '#059669';
                lightColor = '#ECFDF5';
              } else if (careersTheme === 'terracotta') {
                primaryColor = '#C85A32';
                hoverColor = '#AF4B27';
                lightColor = '#F9EFEA';
              }

              let fontStyle = 'var(--font-body)';
              if (careersFont === 'serif') {
                fontStyle = 'var(--font-display)';
              } else if (careersFont === 'mono') {
                fontStyle = 'var(--font-mono)';
              }

              return (
                <div 
                  className="scroll-container" 
                  style={{
                    flex: 1,
                    padding: '2rem',
                    overflowY: 'auto',
                    backgroundColor: 'var(--color-white)',
                    fontFamily: fontStyle,
                    color: 'var(--color-ink)'
                  }}
                >
                  {appSubmitted ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', textAlign: 'center', padding: '3rem 1rem' }}>
                      <div className="success-checkmark-circle" style={{ borderColor: primaryColor }}>
                        <Check size={36} style={{ color: primaryColor }} />
                      </div>
                      <h4 style={{ fontSize: '1.5rem', color: primaryColor }}>Submitting Application...</h4>
                      <p className="text-sm text-muted">Simulating career site API transmission & ATS processing</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h2 style={{ fontSize: '1.6rem', marginBottom: '0.5rem', color: primaryColor }}>{jobTitle}</h2>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                          <span className="candidate-verdict shortlisted" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', backgroundColor: 'var(--color-paper-darker)', color: 'var(--color-ink)', border: '1px solid var(--color-border)' }}>📍 Bangalore, IN</span>
                          <span className="candidate-verdict shortlisted" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', backgroundColor: 'var(--color-paper-darker)', color: 'var(--color-ink)', border: '1px solid var(--color-border)' }}>💰 Competitive Salary</span>
                          <span className="candidate-verdict shortlisted" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', backgroundColor: 'var(--color-paper-darker)', color: 'var(--color-ink)', border: '1px solid var(--color-border)' }}>💼 Full-Time</span>
                        </div>
                        
                        <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--color-ink-muted)', marginBottom: '0.5rem' }}>Required Key Skills</h4>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                          {skillsList.map((skill, idx) => (
                            <span key={idx} className="keyword-chip matched" style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', backgroundColor: lightColor, color: primaryColor, borderColor: 'rgba(0,0,0,0.05)' }}>{skill}</span>
                          ))}
                        </div>
                        
                        <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--color-ink-muted)', marginBottom: '0.5rem' }}>Job Details</h4>
                        <div style={{ backgroundColor: 'var(--color-paper-light)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '1rem', maxHeight: '150px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                          <pre style={{ fontFamily: 'inherit', fontSize: '0.82rem', whiteSpace: 'pre-wrap', color: 'var(--color-ink-light)', margin: 0 }}>
                            {jobDescription}
                          </pre>
                        </div>
                      </div>
                      
                      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: primaryColor }}>Submit Application</h3>
                        <form onSubmit={handleMockSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label text-xs">Full Name</label>
                              <input 
                                type="text" 
                                className="input-text text-sm" 
                                placeholder="e.g. Jane Doe"
                                value={appFormName}
                                onChange={(e) => setAppFormName(e.target.value)}
                                required
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label text-xs">Email Address</label>
                              <input 
                                type="email" 
                                className="input-text text-sm" 
                                placeholder="e.g. jane.doe@example.com"
                                value={appFormEmail}
                                onChange={(e) => setAppFormEmail(e.target.value)}
                                required
                              />
                            </div>
                          </div>
                          
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label text-xs">Resume Profile Text (Paste Resume Details)</label>
                            <textarea 
                              className="input-textarea text-sm" 
                              placeholder="Paste resume text or skills bio here..."
                              style={{ minHeight: '80px' }}
                              value={appFormResume}
                              onChange={(e) => setAppFormResume(e.target.value)}
                              required
                            />
                          </div>
                          
                          <button
                            type="submit"
                            className="btn-primary"
                            style={{ 
                              marginTop: '0.5rem', 
                              width: 'auto', 
                              alignSelf: 'flex-start', 
                              padding: '0.55rem 1.5rem', 
                              fontSize: '0.85rem',
                              background: `linear-gradient(135deg, ${primaryColor}, ${hoverColor})`,
                              boxShadow: `0 4px 10px rgba(0,0,0,0.05)`
                            }}
                          >
                            Submit Mock Application
                          </button>
                        </form>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
          
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', background: 'var(--color-paper-darker)', textAlign: 'right' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsCareersPreviewOpen(false)}
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    );
  };

  const stats = getResultsStatistics();

  const calculateKpis = () => {
    const scored = enrichedCandidates.filter(c => c.status === 'completed');
    if (scored.length === 0) return { avgScore: 0, count: 0, immediateCount: 0, underBudgetCount: 0 };
    
    let sumScore = 0;
    let immediateCount = 0;
    let underBudgetCount = 0;
    const budgetLimit = 25; // 25 LPA budget
    
    scored.forEach(c => {
      sumScore += getCandidateDisplayScore(c) || 0;
      const np = c.evaluation?.notice_period || c.noticePeriod;
      if (np === 'Immediate') {
        immediateCount++;
      }
      const expCtc = c.evaluation?.expected_ctc || c.expectedCtc || 0;
      if (expCtc <= budgetLimit) {
        underBudgetCount++;
      }
    });
    
    return {
      avgScore: Math.round(sumScore / scored.length),
      count: scored.length,
      immediateCount,
      underBudgetCount
    };
  };

  const kpis = calculateKpis();
  
  // Sorted and Filtered results (highest score first)
  const completedCandidates = enrichedCandidates
    .filter(c => {
      if (c.status === 'screening' || c.status === 'failed') return true;
      if (c.status !== 'completed') return false;
      
      const dispScore = getCandidateDisplayScore(c);
      
      // Filter by min score threshold
      if (dispScore < minScoreFilter) return false;
      
      // Filter by salary budget
      const expectedCtc = c.evaluation?.expected_ctc || c.expectedCtc || 0;
      if (expectedCtc > maxExpectedCtc) return false;
      
      // Filter by notice period
      const np = c.evaluation?.notice_period || c.noticePeriod || 'any';
      if (noticePeriodFilter !== 'any') {
        if (noticePeriodFilter === 'immediate' && np !== 'Immediate') return false;
        if (noticePeriodFilter === '30' && np !== 'Immediate' && np !== '15 days' && np !== '30 days') return false;
      }
      
      // Filter by location
      if (locationFilter.trim() !== '') {
        const locQuery = locationFilter.toLowerCase();
        const candLoc = (c.evaluation?.location || c.location || '').toLowerCase();
        const candPrefLoc = (c.evaluation?.preferred_location || c.preferredLocation || '').toLowerCase();
        if (!candLoc.includes(locQuery) && !candPrefLoc.includes(locQuery)) return false;
      }

      // Filter by active skill cloud filters
      if (activeSkillFilters.length > 0) {
        const candidateTextLower = (c.text || '').toLowerCase();
        const matchesAllSkills = activeSkillFilters.every(skill => {
          let pattern;
          const kw = skill.toLowerCase();
          if (/[+#]/.test(kw)) {
            pattern = new RegExp('(^|\\s)' + escapeRegExp(kw) + '(\\s|$|\\.)', 'i');
          } else {
            pattern = new RegExp('\\b' + escapeRegExp(kw) + '\\b', 'i');
          }
          return pattern.test(candidateTextLower);
        });
        if (!matchesAllSkills) return false;
      }
      
      // Filter by search text query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const candidateName = (c.evaluation?.candidate_name || c.name || '').toLowerCase();
        const email = extractEmail(c).toLowerCase();
        const text = (c.text || '').toLowerCase();
        return candidateName.includes(query) || email.includes(query) || text.includes(query);
      }
      
      return true;
    })
    .sort((a, b) => {
      if (a.status === 'screening') return -1;
      if (b.status === 'screening') return 1;
      return (getCandidateDisplayScore(b) || 0) - (getCandidateDisplayScore(a) || 0);
    });

  const completedScoredCandidates = completedCandidates.filter(c => c.status === 'completed');

  return (
    <div className="app-container">
      {/* 1. SETUP PANEL (LEFT COLUMN) */}
      <aside className="sidebar">
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>RecruitPro ATS</h2>
          <p className="text-xs text-muted" style={{ fontStyle: 'italic' }}>
            Executive Recruitment Tool
          </p>
        </div>

        {/* Job openings selector dropdown card */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <span style={{ fontWeight: '800', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
            Active Job Opening
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              className="input-text text-sm"
              style={{ padding: '0.55rem 0.75rem', height: 'auto', border: '1px solid var(--color-border)', flex: 1 }}
              value={activeJobId}
              onChange={(e) => handleSelectJob(e.target.value)}
            >
              {jobs.map(job => (
                <option key={job.id} value={job.id}>{job.title}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', padding: '0.55rem 0.75rem', fontSize: '0.85rem' }}
              onClick={() => setIsJobModalOpen(true)}
              title="Create New Job Opening"
            >
              +
            </button>
          </div>
        </div>

        {/* WORKFLOW 1: Job Specification */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
            <span style={{ fontWeight: '800', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              1. Job Details
            </span>
            <button 
              type="button" 
              className="btn-secondary" 
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
              onClick={() => jdFileInputRef.current?.click()}
            >
              <Upload size={12} /> Upload JD
            </button>
            <input 
              type="file" 
              ref={jdFileInputRef} 
              style={{ display: 'none' }} 
              accept=".pdf,.docx,.txt"
              onChange={handleJdFileUpload} 
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Job Title</label>
            <input 
              type="text" 
              className="input-text" 
              placeholder="e.g. Lead Software Engineer"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Job Description</label>
            <textarea 
              className="input-textarea" 
              style={{ minHeight: '120px' }}
              placeholder="Paste job description details..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Must-Haves / Specs (Optional)</label>
            <textarea 
              className="input-textarea" 
              style={{ minHeight: '80px' }}
              placeholder="e.g. 5+ years React, AWS cert, system design..."
              value={mustHaves}
              onChange={(e) => setMustHaves(e.target.value)}
            />
          </div>
        </div>

        {/* AI Job Description Optimizer Widget */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
            <span style={{ fontWeight: '800', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Sparkles size={14} style={{ color: 'var(--color-terracotta)' }} /> AI JD Generator
            </span>
          </div>
          <span className="text-xs text-muted">Select a template to instantly generate optimized job descriptions and keywords:</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button 
              type="button" 
              className="btn-secondary" 
              style={{ fontSize: '0.7rem', padding: '0.35rem 0.5rem', justifyContent: 'center' }}
              onClick={() => {
                setJobTitle(JD_TEMPLATES.react_developer.title);
                setJobDescription(JD_TEMPLATES.react_developer.description);
                setMustHaves(JD_TEMPLATES.react_developer.mustHaves);
              }}
            >
              React Dev
            </button>
            <button 
              type="button" 
              className="btn-secondary" 
              style={{ fontSize: '0.7rem', padding: '0.35rem 0.5rem', justifyContent: 'center' }}
              onClick={() => {
                setJobTitle(JD_TEMPLATES.python_data_scientist.title);
                setJobDescription(JD_TEMPLATES.python_data_scientist.description);
                setMustHaves(JD_TEMPLATES.python_data_scientist.mustHaves);
              }}
            >
              Data Scientist
            </button>
            <button 
              type="button" 
              className="btn-secondary" 
              style={{ fontSize: '0.7rem', padding: '0.35rem 0.5rem', justifyContent: 'center' }}
              onClick={() => {
                setJobTitle(JD_TEMPLATES.product_manager.title);
                setJobDescription(JD_TEMPLATES.product_manager.description);
                setMustHaves(JD_TEMPLATES.product_manager.mustHaves);
              }}
            >
              Product Mgr
            </button>
            <button 
              type="button" 
              className="btn-secondary" 
              style={{ fontSize: '0.7rem', padding: '0.35rem 0.5rem', justifyContent: 'center' }}
              onClick={() => {
                setJobTitle(JD_TEMPLATES.qa_automation_engineer.title);
                setJobDescription(JD_TEMPLATES.qa_automation_engineer.description);
                setMustHaves(JD_TEMPLATES.qa_automation_engineer.mustHaves);
              }}
            >
              QA Engineer
            </button>
          </div>
          <button 
            type="button" 
            className="btn-primary" 
            style={{ fontSize: '0.8rem', padding: '0.55rem 1rem', marginTop: '0.5rem', background: 'linear-gradient(135deg, var(--color-sage), var(--color-sage-hover))', boxShadow: 'none' }}
            onClick={() => setIsCareersPreviewOpen(true)}
          >
            👁 Preview Public Careers Page
          </button>
        </div>

        {/* WORKFLOW 2: Candidates Upload & Pastes */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <span style={{ fontWeight: '800', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
            2. Candidates
          </span>

          <div 
            className={`dropzone ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => candidateFileInputRef.current?.click()}
          >
            <Upload size={24} style={{ color: 'var(--color-terracotta)' }} />
            <p style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-ink-light)' }}>
              Drag & drop résumés or <span style={{ color: 'var(--color-terracotta)', textDecoration: 'underline' }}>browse</span>
            </p>
            <p className="text-xs text-muted">Supports PDF, DOCX, TXT, PNG, JPG</p>
            <input 
              type="file" 
              ref={candidateFileInputRef} 
              style={{ display: 'none' }} 
              multiple 
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
              onChange={handleBrowseFiles}
            />
          </div>

          {/* Paste Fallback Collapsible */}
          <div>
            <button 
              type="button" 
              className="btn-secondary" 
              style={{ width: '100%', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
              onClick={() => setPasteFallbackOpen(!pasteFallbackOpen)}
            >
              <span>Paste Résumé Text Alternative</span>
              {pasteFallbackOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {pasteFallbackOpen && (
              <div className="file-fallback-box animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.50rem', marginTop: '0.50rem' }}>
                <input 
                  type="text" 
                  className="input-text text-sm" 
                  placeholder="Candidate Name"
                  value={pasteName}
                  onChange={(e) => setPasteName(e.target.value)}
                />
                <textarea 
                  className="input-textarea text-sm" 
                  style={{ minHeight: '100px' }}
                  placeholder="Paste résumé text layer..."
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
                <button 
                  type="button" 
                  className="btn-primary" 
                  style={{ padding: '0.5rem', fontSize: '0.8rem' }}
                  onClick={handleAddManualCandidate}
                  disabled={!pasteText.trim()}
                >
                  Add Candidate
                </button>
              </div>
            )}
          </div>

          {/* Candidates File status list */}
          {candidates.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Files Queue ({candidates.length})</span>
                <button 
                  type="button" 
                  style={{ background: 'none', border: 'none', color: 'var(--color-red)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                  onClick={() => setCandidates([])}
                >
                  <Trash2 size={12} /> Clear all
                </button>
              </div>

              <div className="file-list scroll-container">
                {enrichedCandidates.map((candidate) => (
                  <div key={candidate.id} className="flex-col gap-2" style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.6rem 0.75rem', backgroundColor: 'var(--color-white)' }}>
                    <div className="flex justify-between items-center w-full">
                      <div className="file-info">
                        <FileText size={16} style={{ color: 'var(--color-ink-light)', flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span className="file-name" style={{ fontSize: '0.8rem' }}>{candidate.name}</span>
                          <span className="file-size">{formatBytes(candidate.fileSize)}</span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {candidate.status === 'reading' && (
                          <span className="status-indicator" style={{ color: 'var(--color-gold)' }}>
                            <span className="dot reading"></span> reading...
                          </span>
                        )}
                        {candidate.status === 'ocr_progress' && (
                          <span className="status-indicator" style={{ color: 'var(--color-terracotta)' }}>
                            <span className="dot ocr"></span> OCR {candidate.ocrProgress}%
                          </span>
                        )}
                        {candidate.status === 'ready' && (
                          <span className="status-indicator" style={{ color: 'var(--color-sage)' }}>
                            <span className="dot ready"></span> {candidate.numChars} chars
                          </span>
                        )}
                        {candidate.status === 'screening' && (
                          <span className="status-indicator" style={{ color: 'var(--color-terracotta)', animation: 'pulse 1s infinite' }}>
                            screening...
                          </span>
                        )}
                        {candidate.status === 'completed' && (
                          <span className="status-indicator" style={{ color: 'var(--color-sage)' }}>
                            Score: {candidate.score}
                          </span>
                        )}
                        {candidate.status === 'failed' && (
                          <span className="status-indicator" style={{ color: 'var(--color-red)' }}>
                            <span className="dot error"></span> failed
                          </span>
                        )}

                        <button 
                          type="button" 
                          style={{ background: 'none', border: 'none', color: 'var(--color-ink-muted)', cursor: 'pointer' }}
                          onClick={() => removeCandidate(candidate.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {candidate.status === 'failed' && (
                      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.4rem' }}>
                        <span className="text-xs text-red" style={{ color: 'var(--color-red)' }}>
                          Error: {candidate.errorDetails}
                        </span>
                        <div className="flex gap-2">
                          <button 
                            type="button" 
                            className="btn-secondary" 
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                            onClick={() => handleOcrRetry(candidate.id)}
                          >
                            <RefreshCw size={10} /> Run OCR Retry
                          </button>
                        </div>
                        <div style={{ marginTop: '0.2rem' }}>
                          <textarea 
                            className="input-textarea text-xs" 
                            style={{ minHeight: '60px', padding: '0.4rem' }}
                            placeholder="Or paste resume text manually here to fix..."
                            onChange={(e) => handleManualTextPasteFix(candidate.id, e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* WORKFLOW 3: Shortlist slider & Trigger button */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <span style={{ fontWeight: '800', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
            3. Shortlist Settings
          </span>

          <div className="slider-container">
            <div className="slider-labels">
              <span>Threshold Bar</span>
              <span className="slider-val">{threshold} / 100</span>
            </div>
            <input 
              type="range" 
              min="50" 
              max="95" 
              value={threshold} 
              onChange={(e) => setThreshold(parseInt(e.target.value))}
            />
            <span className="text-xs text-muted">
              Profiles scoring equal or higher than {threshold} are designated as shortlisted matches.
            </span>
          </div>

          <button 
            type="button" 
            className="btn-primary" 
            style={{ width: '100%', py: '1rem' }}
            onClick={handleScreenAndRank}
            disabled={isScreening || enrichedCandidates.filter(c => c.status === 'ready').length === 0}
          >
            {isScreening ? (
              <>
                <RefreshCw className="spinner" size={18} style={{ animation: 'spin 1.5s linear infinite' }} />
                <span>Screening {currentScreenIndex + 1} of {candidates.length}...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Screen & Rank {enrichedCandidates.filter(c => c.status === 'ready').length || ''} Candidates</span>
              </>
            )}
          </button>
        </div>

        {/* WORKFLOW 4: Recruitment Filters */}
        {enrichedCandidates.some(c => c.status === 'completed') && (
          <div className="card animate-fade-in" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <span style={{ fontWeight: '800', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              4. Recruitment Filters
            </span>

            <div className="slider-container" style={{ marginBottom: 0 }}>
              <div className="slider-labels">
                <span>Max Expected Salary</span>
                <span className="slider-val" style={{ color: 'var(--color-terracotta)' }}>{maxExpectedCtc} LPA</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="60" 
                value={maxExpectedCtc} 
                onChange={(e) => setMaxExpectedCtc(parseInt(e.target.value))}
                style={{ cursor: 'pointer' }}
              />
              <span className="text-xs text-muted">
                Hide candidates asking more than {maxExpectedCtc} LPA.
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Notice Period</label>
              <select 
                className="input-text text-sm" 
                style={{ padding: '0.4rem 0.75rem', height: 'auto', border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-ink)' }}
                value={noticePeriodFilter}
                onChange={(e) => setNoticePeriodFilter(e.target.value)}
              >
                <option value="any">Any Notice Period</option>
                <option value="immediate">Immediate Joiners Only</option>
                <option value="30">Max 30 Days Notice</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Target Location</label>
              <input 
                type="text" 
                className="input-text text-sm" 
                placeholder="e.g. Bangalore, Mumbai"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              />
            </div>
            
            {(maxExpectedCtc < 40 || noticePeriodFilter !== 'any' || locationFilter !== '') && (
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ fontSize: '0.75rem', justifyContent: 'center', width: '100%' }}
                onClick={() => {
                  setMaxExpectedCtc(40);
                  setNoticePeriodFilter('any');
                  setLocationFilter('');
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        )}
      </aside>

      {/* 2. RESULTS PANEL (RIGHT COLUMN) */}
      <main className="main-panel">
        <header className="app-header">
          <div className="app-branding">
            <span className="app-logo">🎯</span>
            <div>
              <h1 className="app-title">RecruitPro ATS</h1>
              <p className="text-sm text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span>Objective Decision Support System</span>
                <span>•</span>
                <span>Offline Scorer Engine</span>
                <span>•</span>
                <span 
                  onClick={() => setIsSupabaseModalOpen(true)}
                  style={{ 
                    cursor: 'pointer', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.3rem', 
                    padding: '0.15rem 0.5rem', 
                    borderRadius: '10px', 
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    background: supabaseStatus === 'connected' ? 'rgba(46, 117, 89, 0.15)' : supabaseStatus === 'schema_missing' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: supabaseStatus === 'connected' ? 'var(--color-sage)' : supabaseStatus === 'schema_missing' ? '#e28509' : 'var(--color-red)',
                    border: `1px solid ${supabaseStatus === 'connected' ? 'rgba(46, 117, 89, 0.3)' : supabaseStatus === 'schema_missing' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    transition: 'all 0.3s ease'
                  }}
                  title="Click to manage Supabase database integration"
                >
                  <span className={`dot ${supabaseStatus === 'connected' ? 'active' : ''}`} style={{ 
                    width: '6px', 
                    height: '6px', 
                    borderRadius: '50%', 
                    background: supabaseStatus === 'connected' ? 'var(--color-sage)' : supabaseStatus === 'schema_missing' ? 'orange' : 'var(--color-red)',
                    display: 'inline-block'
                  }}></span>
                  Supabase: {supabaseStatus === 'connected' ? 'Connected' : supabaseStatus === 'schema_missing' ? 'Tables Missing' : supabaseStatus === 'connecting' ? 'Connecting...' : 'Error / Disconnected'}
                </span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Theme Toggle Button */}
            <button
              type="button"
              className="btn-secondary"
              style={{
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
                background: 'var(--color-white)',
                color: 'var(--color-ink)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'var(--transition-smooth)'
              }}
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* View Mode Switcher */}
            {enrichedCandidates.some(c => c.status === 'completed') && (
              <div className="view-toggle-bar" style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'var(--color-paper-darker)', padding: '0.25rem', borderRadius: 'var(--radius-sm)' }}>
                <button 
                  type="button" 
                  className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', border: 'none', background: viewMode === 'grid' ? 'var(--color-white)' : 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: viewMode === 'grid' ? 'bold' : 'normal', color: 'var(--color-ink)', boxShadow: viewMode === 'grid' ? 'var(--shadow-sm)' : 'none' }}
                  onClick={() => setViewMode('grid')}
                >
                  Grid View
                </button>
                <button 
                  type="button" 
                  className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
                  style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', border: 'none', background: viewMode === 'kanban' ? 'var(--color-white)' : 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: viewMode === 'kanban' ? 'bold' : 'normal', color: 'var(--color-ink)', boxShadow: viewMode === 'kanban' ? 'var(--shadow-sm)' : 'none' }}
                  onClick={() => setViewMode('kanban')}
                >
                  Kanban Pipeline
                </button>
                <button 
                  type="button" 
                  className={`view-toggle-btn ${viewMode === 'analytics' ? 'active' : ''}`}
                  style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', border: 'none', background: viewMode === 'analytics' ? 'var(--color-white)' : 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: viewMode === 'analytics' ? 'bold' : 'normal', color: 'var(--color-ink)', boxShadow: viewMode === 'analytics' ? 'var(--shadow-sm)' : 'none' }}
                  onClick={() => setViewMode('analytics')}
                >
                  Hiring Analytics
                </button>
              </div>
            )}
          </div>
        </header>

        {/* KPI Dashboard Stats Ribbon */}
        {enrichedCandidates.some(c => c.status === 'completed') && (
          <div className="kpi-grid animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '-1rem' }}>
            <div className="card kpi-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="kpi-icon-container" style={{ background: 'var(--color-terracotta-light)', color: 'var(--color-terracotta)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                📊
              </div>
              <div>
                <span className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Average Score</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'var(--font-mono)', margin: 0 }}>{kpis.avgScore}%</h3>
              </div>
            </div>
            
            <div className="card kpi-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="kpi-icon-container" style={{ background: 'var(--color-sage-light)', color: 'var(--color-sage)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                👥
              </div>
              <div>
                <span className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Screened</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'var(--font-mono)', margin: 0 }}>{kpis.count} Candidates</h3>
              </div>
            </div>

            <div className="card kpi-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="kpi-icon-container" style={{ background: 'var(--color-gold-light)', color: 'var(--color-gold)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                ⚡
              </div>
              <div>
                <span className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Immediate Joiners</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'var(--font-mono)', margin: 0 }}>{kpis.immediateCount} Profiles</h3>
              </div>
            </div>

            <div className="card kpi-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="kpi-icon-container" style={{ background: 'rgba(78, 194, 116, 0.12)', color: 'var(--color-sage)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                💰
              </div>
              <div>
                <span className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Under Budget (≤25L)</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'var(--font-mono)', margin: 0 }}>{kpis.underBudgetCount} Matches</h3>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters toolbar */}
        {enrichedCandidates.some(c => c.status === 'completed' || c.status === 'failed') && (
          <div className="toolbar-bar animate-fade-in" style={{ display: 'flex', gap: '1rem', alignItems: 'center', backgroundColor: 'var(--color-white)', padding: '1rem 1.25rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', flexWrap: 'wrap', marginTop: '-1rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', flex: 1, minWidth: '280px', position: 'relative' }}>
              <input 
                type="text" 
                className="input-text text-sm" 
                placeholder="Search candidates by name, email, skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '0.55rem 1rem', paddingRight: '2.5rem' }}
              />
              {searchQuery && (
                <button 
                  type="button" 
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '240px' }}>
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Min Score:</span>
              <input 
                type="range" 
                min="50" 
                max="95" 
                value={minScoreFilter} 
                onChange={(e) => setMinScoreFilter(parseInt(e.target.value))}
                style={{ flex: 1, height: '4px', cursor: 'pointer' }}
              />
              <span className="mono-font text-sm font-bold" style={{ color: 'var(--color-terracotta)', minWidth: '24px' }}>
                {minScoreFilter}+
              </span>
              {minScoreFilter > 50 && (
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                  onClick={() => setMinScoreFilter(50)}
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}

        {/* Trending Skills Ribbon */}
        {enrichedCandidates.some(c => c.status === 'completed') && (
          <div className="card skill-cloud-container" style={{ padding: '0.85rem 1.25rem', marginTop: '-0.25rem', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-xs font-bold uppercase tracking-wider text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                🔥 Trending Skill Cloud Filter
              </span>
              {activeSkillFilters.length > 0 && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}
                  onClick={() => setActiveSkillFilters([])}
                >
                  Clear Filters
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              {getTrendingSkills().map(skill => {
                const isActive = activeSkillFilters.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    className={`skill-tag-chip ${isActive ? 'active' : ''}`}
                    onClick={() => handleToggleSkillFilter(skill)}
                    style={{
                      background: isActive ? 'var(--color-terracotta)' : 'var(--color-paper-darker)',
                      color: isActive ? 'var(--color-white)' : 'var(--color-ink-light)',
                      border: '1px solid ' + (isActive ? 'var(--color-terracotta)' : 'var(--color-border)'),
                      borderRadius: 'var(--radius-full)',
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      boxShadow: isActive ? '0 0 10px var(--color-terracotta-light)' : 'none',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    {skill} {isActive ? '✕' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Informative Dashboard summary */}
        {completedCandidates.length > 0 && (
          <div className="summary-bar animate-fade-in">
            <div className="summary-item">
              <span className="dot ready"></span>
              <span className="stat-number">{stats.shortlisted}</span>
              <span>shortlisted</span>
            </div>
            <span style={{ color: 'var(--color-border)' }}>|</span>
            <div className="summary-item">
              <span className="dot reading"></span>
              <span className="stat-number">{stats.borderline}</span>
              <span>borderline</span>
            </div>
            <span style={{ color: 'var(--color-border)' }}>|</span>
            <div className="summary-item">
              <span className="dot error"></span>
              <span className="stat-number">{stats.notFit}</span>
              <span>not a fit</span>
            </div>
            <span style={{ color: 'var(--color-border)', marginLeft: 'auto' }}></span>
            <div className="text-xs text-muted" style={{ marginLeft: 'auto', fontStyle: 'italic' }}>
              Final outcomes subject to recruiter human verification.
            </div>
          </div>
        )}

        {/* Selection Control Bar */}
        {completedScoredCandidates.length > 0 && (
          <div className="selection-bar animate-fade-in">
            <div className="flex items-center gap-3">
              <label className="checkbox-container">
                <input 
                  type="checkbox"
                  checked={completedScoredCandidates.length > 0 && completedScoredCandidates.every(c => selectedCandidateIds.includes(c.id))}
                  onChange={() => handleToggleSelectAll(completedScoredCandidates)}
                />
                <span className="checkbox-checkmark"></span>
              </label>
              <span className="text-sm font-semibold">
                {selectedCandidateIds.length} of {completedScoredCandidates.length} Selected
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              {selectedCandidateIds.length > 1 && (
                <button 
                  type="button" 
                  className="btn-primary select-compare-btn"
                  style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.8rem', backgroundColor: 'var(--color-sage)' }}
                  onClick={() => setIsCompareModalOpen(true)}
                >
                  <RefreshCw size={12} style={{ transform: 'rotate(90deg)' }} />
                  <span>Compare ({selectedCandidateIds.length})</span>
                </button>
              )}
              {selectedCandidateIds.length > 0 && (
                <button 
                  type="button" 
                  className="btn-primary select-send-btn"
                  style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                  onClick={handleOpenEmailModal}
                >
                  <Mail size={14} />
                  <span>Send Batch Emails ({selectedCandidateIds.length})</span>
                </button>
              )}
              {selectedCandidateIds.length > 0 && (
                <button 
                  type="button" 
                  className="btn-secondary select-export-btn"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                  onClick={handleExportCsv}
                >
                  Export CSV ({selectedCandidateIds.length})
                </button>
              )}
              <button 
                type="button" 
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                onClick={() => setSelectedCandidateIds([])}
                disabled={selectedCandidateIds.length === 0}
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Results Screen */}
        {!enrichedCandidates.some(c => c.status === 'completed' || c.status === 'screening' || c.status === 'failed') ? (
          <div className="card text-center animate-fade-in" style={{ padding: '6rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', borderStyle: 'dashed' }}>
            <span style={{ fontSize: '3rem' }}>📁</span>
            <div>
              <h3 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>No Screenings Conducted Yet</h3>
              <p style={{ maxWidth: '480px', margin: '0 auto', fontSize: '0.95rem' }} className="text-muted">
                Set up your Job Details, upload résumés in the setup panel on the left, and trigger the batch screen to rank candidates.
              </p>
            </div>
            <div className="flex gap-4 justify-center" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
              <div className="flex items-center gap-1 text-xs text-muted">
                <Check size={14} style={{ color: 'var(--color-sage)' }} /> PDF/Word Text Extraction
              </div>
              <div className="flex items-center gap-1 text-xs text-muted">
                <Check size={14} style={{ color: 'var(--color-sage)' }} /> Dynamic OCR Fallbacks
              </div>
              <div className="flex items-center gap-1 text-xs text-muted">
                <Check size={14} style={{ color: 'var(--color-sage)' }} /> Bias-Free Weighted Scoring
              </div>
            </div>
          </div>
        ) : completedCandidates.length === 0 ? (
          <div className="card text-center animate-fade-in" style={{ padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', borderStyle: 'dashed' }}>
            <span style={{ fontSize: '2.5rem' }}>🔍</span>
            <div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>No Matching Candidates Found</h3>
              <p style={{ maxWidth: '480px', margin: '0 auto', fontSize: '0.9rem' }} className="text-muted">
                No candidates scored {minScoreFilter}+ or matched your keyword search query. Try clearing your filters.
              </p>
            </div>
            <button 
              type="button" 
              className="btn-primary" 
              style={{ width: 'auto', padding: '0.55rem 1.75rem', fontSize: '0.85rem' }}
              onClick={() => { setSearchQuery(''); setMinScoreFilter(50); }}
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'analytics' ? (
          renderAnalyticsDashboard()
        ) : viewMode === 'kanban' ? (
          renderKanbanBoard()
        ) : (
          <div className="candidate-grid">
            {completedCandidates.map((candidate, idx) => {
              if (candidate.status === 'screening') {
                return (
                  <div key={candidate.id} className="candidate-card" style={{ opacity: 0.7, borderStyle: 'dashed', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3.5rem' }}>
                    <RefreshCw className="spinner" size={32} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--color-terracotta)' }} />
                    <div className="text-center" style={{ marginTop: '1rem' }}>
                      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>Screening Profile</h4>
                      <p className="text-sm text-muted">{candidate.name}</p>
                      <p className="text-xs mono-font" style={{ color: 'var(--color-terracotta)', marginTop: '0.25rem' }}>Running offline ATS engine...</p>
                    </div>
                  </div>
                );
              }

              if (candidate.status === 'failed') {
                return (
                  <div key={candidate.id} className="candidate-card" style={{ borderColor: 'var(--color-red)' }}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={24} style={{ color: 'var(--color-red)' }} />
                        <div>
                          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-red)' }}>Screening Failed</h4>
                          <p className="text-sm text-muted">{candidate.name}</p>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        style={{ borderColor: 'var(--color-red)', color: 'var(--color-red)' }}
                        onClick={() => {
                          // Trigger screening specifically for this candidate again
                          // By setting status to 'ready' and triggering screening
                          setCandidates(prev => prev.map(c => {
                            if (c.id === candidate.id) return { ...c, status: 'ready' };
                            return c;
                          }));
                          // Delay slightly then run screening
                          setTimeout(() => {
                            handleScreenAndRank();
                          }, 100);
                        }}
                      >
                        Retry Screen
                      </button>
                    </div>
                    <div className="file-fallback-box" style={{ marginTop: '1rem', backgroundColor: 'var(--color-red-light)', borderColor: 'rgba(197, 83, 83, 0.15)' }}>
                      <span className="text-sm font-semibold text-ink">Details:</span>
                      <p className="text-xs" style={{ color: 'var(--color-red)', marginTop: '0.2rem', whiteSpace: 'pre-wrap' }}>
                        {candidate.errorDetails}
                      </p>
                    </div>
                  </div>
                );
              }

              // Normal Completed Scored Candidate Card
              const displayScore = getCandidateDisplayScore(candidate);
              const outcome = getNextStepDetails(displayScore, threshold);
              const evalData = candidate.evaluation || analyzeCandidateOffline(candidate, jobTitle, jobDescription, mustHaves);
              
              // Match Flags calculations
              const isUnderBudget = (evalData.expected_ctc || candidate.expectedCtc || 0) <= 25;
              const isShortNotice = ['Immediate', '15 days', '30 days'].includes(evalData.notice_period || candidate.noticePeriod);
              
              const scorecard = candidate.scorecard || { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "" };
              const { technical, communication, problemSolving, cultureFit } = scorecard;
              const avgRating = (technical + communication + problemSolving + cultureFit) / 4;
              
              const logs = evalData.activity_log || candidate.activityLog || [];
              const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;

              return (
                <article key={candidate.id} className="candidate-card animate-fade-in" style={{ animationDelay: `${idx * 0.1}s`, borderLeft: candidate.stage === 'hired' ? '4px solid var(--color-sage)' : candidate.stage === 'rejected' ? '4px solid var(--color-red)' : '' }}>
                  
                  {candidate.stage === 'hired' && (
                    <div className="celebration-ribbon animate-pulse" style={{ background: 'var(--color-sage-light)', color: 'var(--color-sage)', padding: '0.35rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(95,125,101,0.2)' }}>
                      🎉 HIRED CANDIDATE! Onboarding in progress
                    </div>
                  )}

                  {/* Card Header: Rank, Name, Badges, & Score */}
                  <div className="candidate-card-header">
                    <div className="flex items-start gap-3 flex-1" style={{ minWidth: 0 }}>
                      <label className="checkbox-container" style={{ marginTop: '0.35rem' }}>
                        <input 
                          type="checkbox"
                          checked={selectedCandidateIds.includes(candidate.id)}
                          onChange={() => handleToggleSelectCandidate(candidate.id)}
                        />
                        <span className="checkbox-checkmark"></span>
                      </label>
                      <div className="candidate-meta" style={{ minWidth: 0 }}>
                        <div className="candidate-rank-name" style={{ display: 'flex', alignItems: 'center', gap: '0.50rem', flexWrap: 'wrap' }}>
                          <span className="candidate-rank">Rank #{idx + 1}</span>
                          <h3 className="candidate-name" style={{ margin: 0 }}>{evalData.candidate_name || candidate.name}</h3>
                          
                          {/* Notice Period, Expected CTC & Location Tags */}
                          <span className="keyword-chip matched" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', backgroundColor: 'var(--color-terracotta-light)', color: 'var(--color-terracotta)', borderColor: 'rgba(200,90,50,0.1)' }}>
                            ⚡ {evalData.notice_period || candidate.noticePeriod}
                          </span>
                          <span className="keyword-chip matched" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', backgroundColor: 'rgba(78, 194, 116, 0.08)', color: 'var(--color-sage)', borderColor: 'rgba(78,194,116,0.1)' }}>
                            💰 {evalData.expected_ctc || candidate.expectedCtc} LPA
                          </span>
                          <span className="keyword-chip matched" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', backgroundColor: 'var(--color-gold-light)', color: 'var(--color-gold)', borderColor: 'rgba(192,154,85,0.1)' }}>
                            📍 {evalData.location || candidate.location}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className={`candidate-verdict ${outcome.badgeClass}`}>
                            {outcome.badge} Match
                          </span>
                          {sentEmails[candidate.id] && (
                            <span className="candidate-verdict shortlisted" style={{ backgroundColor: 'var(--color-sage-light)', color: 'var(--color-sage)', border: '1px solid rgba(95, 125, 101, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <CheckCircle size={11} /> Email Sent
                            </span>
                          )}
                          {candidate.interview && (
                            <span className="candidate-verdict shortlisted" style={{ backgroundColor: 'var(--color-gold-light)', color: 'var(--color-gold)', border: '1px solid rgba(192, 154, 85, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              📅 Interview Scheduled
                            </span>
                          )}
                          <span className="text-xs text-muted">•</span>
                          <span className="text-xs text-muted mono-font">{candidate.fileName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="candidate-score-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className={`candidate-score-badge ${displayScore >= threshold ? 'high' : displayScore >= threshold - 15 ? 'medium' : 'low'}`}>
                        <span className="candidate-score-val">{displayScore}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', color: 'var(--color-ink-muted)', fontWeight: '750', letterSpacing: '0.05em', lineHeight: '1' }}>overall</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--color-ink-light)', lineHeight: '1.2', marginTop: '0.15rem' }}>alignment</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick assessment match flags */}
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                    {isUnderBudget ? (
                      <span style={{ color: 'var(--color-sage)', display: 'flex', alignItems: 'center', gap: '0.15rem', fontWeight: '600' }}>
                        ✓ Under Budget
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-red)', display: 'flex', alignItems: 'center', gap: '0.15rem', fontWeight: '600' }}>
                        ⚠ Over Budget (≤25L budget)
                      </span>
                    )}
                    <span style={{ color: 'var(--color-ink-muted)' }}>|</span>
                    {isShortNotice ? (
                      <span style={{ color: 'var(--color-sage)', display: 'flex', alignItems: 'center', gap: '0.15rem', fontWeight: '600' }}>
                        ✓ Fast Joiner (≤30d)
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-red)', display: 'flex', alignItems: 'center', gap: '0.15rem', fontWeight: '600' }}>
                        ⚠ Long Notice ({evalData.notice_period || candidate.noticePeriod})
                      </span>
                    )}
                  </div>

                  {/* Summary phrase */}
                  <p className="text-sm" style={{ fontStyle: 'italic', borderLeft: '2px solid var(--color-terracotta)', paddingLeft: '0.75rem', color: 'var(--color-ink-light)' }}>
                    "{evalData.summary}"
                  </p>

                  {/* Card quick star rating */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '0.50rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.50rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>Quick Assessment:</span>
                      <div style={{ display: 'flex' }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '1rem',
                              color: star <= Math.round(avgRating) ? 'var(--color-gold)' : 'var(--color-border-hover)',
                              padding: '0 0.05rem'
                            }}
                            onClick={() => updateScorecardField(candidate.id, 'technical', star)} // quick rating updates technical
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-ink-light)' }}>({avgRating.toFixed(1)})</span>
                    </div>

                    {candidate.stage === 'rejected' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-red)' }}>Reason:</span>
                        <select
                          className="text-xs"
                          style={{ padding: '0.15rem 0.35rem', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-red)' }}
                          value={candidate.rejectionReason || 'tech_failed'}
                          onChange={(e) => handleMoveStage(candidate.id, 'rejected', e.target.value)}
                        >
                          <option value="expected_ctc">CTC too high</option>
                          <option value="notice_period">Notice too long</option>
                          <option value="tech_failed">Failed Tech round</option>
                          <option value="poor_communication">Poor communication</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Timeline last action log */}
                  {lastLog && (
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-ink-muted)', width: '100%' }}>
                      <span style={{ color: 'var(--color-terracotta)' }}>●</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}><strong>Activity:</strong> {lastLog.text}</span>
                      <span style={{ marginLeft: 'auto', fontStyle: 'italic', fontSize: '0.7rem' }}>{lastLog.timestamp}</span>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.50rem' }}>
                      <button 
                        type="button" 
                        className="btn-primary text-xs" 
                        style={{ padding: '0.40rem 0.85rem', fontSize: '0.78rem', width: 'auto', backgroundColor: 'var(--color-ink)', background: 'var(--color-ink)', boxShadow: 'none' }}
                        onClick={() => {
                          setDrawerActiveTab('overview');
                          setActiveDrawerCandidateId(candidate.id);
                        }}
                      >
                        <Eye size={12} /> Profile & Timeline
                      </button>

                      <button 
                        type="button" 
                        className="btn-secondary text-xs" 
                        style={{ padding: '0.40rem 0.85rem', fontSize: '0.78rem', width: 'auto' }}
                        onClick={() => {
                          setDrawerActiveTab('scorecard');
                          setActiveDrawerCandidateId(candidate.id);
                        }}
                      >
                        Evaluate
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <select 
                        className="text-xs" 
                        style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-ink)' }}
                        value={candidate.stage || 'screening'}
                        onChange={(e) => handleMoveStage(candidate.id, e.target.value)}
                      >
                        <option value="screening">Screening</option>
                        <option value="shortlisted">Shortlist</option>
                        <option value="interviewing">Interview</option>
                        <option value="offer">Offer</option>
                        <option value="hired">Hired 🎉</option>
                        <option value="rejected">Decline</option>
                      </select>

                      {sentEmails[candidate.id] && (
                        <span className="text-xs text-sage font-bold" style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', color: 'var(--color-sage)' }}>
                          <CheckCircle size={10} /> Sent
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Recommended template composer inline banner */}
                  {!sentEmails[candidate.id] && (
                    <div className={outcome.bannerClass} style={{ marginTop: '0.25rem' }}>
                      <div className="action-banner-header" style={{ padding: '0.5rem 0.75rem' }}>
                        <div className="action-title-group">
                          <span className="action-title" style={{ fontSize: '0.75rem' }}>Recommended Step: {outcome.title}</span>
                        </div>
                        <div className="action-button-container">
                          <button 
                            type="button" 
                            className="btn-primary text-xs" 
                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.70rem', width: 'auto' }}
                            onClick={() => handleDraftEmail(candidate)}
                            disabled={isDraftingId === candidate.id}
                          >
                            {isDraftingId === candidate.id ? "Drafting..." : "Draft Email"}
                          </button>
                        </div>
                      </div>
                      
                      {emailDrafts[candidate.id] && (
                        <div className="email-draft-box animate-fade-in" style={{ margin: '0.5rem', padding: '0.5rem' }}>
                          <div className="email-draft-header">
                            <span className="email-draft-title" style={{ fontSize: '0.72rem' }}>Recruiter Email Draft</span>
                            <div className="flex gap-1">
                              <button 
                                type="button" 
                                className="btn-secondary" 
                                style={{ padding: '0.1rem 0.3rem', fontSize: '0.65rem' }}
                                onClick={() => handleCopyEmail(candidate.id)}
                              >
                                Copy
                              </button>
                              <button 
                                type="button" 
                                className="btn-primary" 
                                style={{ padding: '0.1rem 0.3rem', fontSize: '0.65rem', width: 'auto', backgroundColor: 'var(--color-sage)' }}
                                onClick={() => handleSendSingleEmail(candidate)}
                              >
                                Send
                              </button>
                            </div>
                          </div>
                          <pre className="email-draft-body" style={{ maxHeight: '80px', fontSize: '0.72rem' }}>
                            {emailDrafts[candidate.id]}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>

      {renderProfileDrawer()}
      {renderCareersPreviewModal()}
      {renderCreateJobModal()}
      {renderSupabaseModal()}

      {/* 3. BATCH EMAIL COMPOSER MODAL */}
      {isEmailModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content email-composer-modal">
            {sendingStatus.state === 'idle' ? (
              <>
                <div className="modal-header">
                  <h3 className="modal-title">Bulk Email Dispatcher</h3>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setIsEmailModalOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-light)' }}
                  >
                    <X size={18} />
                  </button>
                </div>
                
                <div className="modal-body email-composer-body">
                  {/* Left Column: Selection list */}
                  <div className="composer-sidebar scroll-container">
                    <span className="composer-section-title">Recipients ({selectedCandidateIds.length})</span>
                    <div className="composer-candidate-list">
                      {selectedCandidateIds.map(id => {
                        const candidate = candidates.find(c => c.id === id);
                        if (!candidate) return null;
                        const outcome = getNextStepDetails(candidate.score, threshold);
                        const isCurrent = activeEmailCandidateId === id;
                        const email = extractEmail(candidate);
                        return (
                          <div 
                            key={id} 
                            className={`composer-candidate-row ${isCurrent ? 'active' : ''}`}
                            onClick={() => setActiveEmailCandidateId(id)}
                          >
                            <div className="flex justify-between items-center w-full">
                              <span className="candidate-row-name" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                {candidate.name} {sentEmails[id] && <span style={{ color: 'var(--color-sage)' }}>✓</span>}
                              </span>
                              <span className={`candidate-verdict ${outcome.badgeClass}`} style={{ padding: '0.15rem 0.45rem', fontSize: '0.65rem' }}>
                                {outcome.badge}
                              </span>
                            </div>
                            <span className="candidate-row-email">{email}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Right Column: Active Email Editor */}
                  <div className="composer-editor">
                    {activeEmailCandidateId && editedEmailDrafts[activeEmailCandidateId] ? (
                      isCustomizingTemplate ? (
                        <div className="flex-col gap-3" style={{ display: 'flex', height: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="composer-section-title" style={{ color: 'var(--color-terracotta)', fontWeight: '800' }}>✏ Customizing Base Template Structure</span>
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ width: 'auto', padding: '0.35rem 1rem', fontSize: '0.85rem', backgroundColor: 'var(--color-sage)' }}
                              onClick={handleSaveCustomTemplate}
                            >
                              Save & Apply Layout
                            </button>
                          </div>
                          
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label text-xs">Template Subject Pattern</label>
                            <input 
                              type="text" 
                              ref={tempSubjectRef}
                              className="input-text text-sm" 
                              placeholder="e.g. Interview Invitation: {{jobTitle}}"
                              value={tempSubject}
                              onChange={(e) => setTempSubject(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                              {['{{candidateName}}', '{{jobTitle}}', '{{matchedSkills}}'].map(pl => (
                                <button
                                  key={pl}
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '0.1rem 0.35rem', fontSize: '0.68rem' }}
                                  onClick={() => insertPlaceholder('subject', pl)}
                                >
                                  + {pl}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="form-group flex-1" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                            <label className="form-label text-xs">Template Body Pattern</label>
                            <textarea 
                              ref={tempBodyRef}
                              className="input-textarea text-sm flex-1" 
                              style={{ minHeight: '180px', flex: 1 }}
                              placeholder="Write base template structure with placeholders..."
                              value={tempBody}
                              onChange={(e) => setTempBody(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                              {['{{candidateName}}', '{{jobTitle}}', '{{matchedSkills}}', '{{senderName}}'].map(pl => (
                                <button
                                  key={pl}
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '0.1rem 0.35rem', fontSize: '0.68rem' }}
                                  onClick={() => insertPlaceholder('body', pl)}
                                >
                                  + {pl}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-col gap-3" style={{ display: 'flex', height: '100%' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label className="form-label text-xs">Email Template</label>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                onClick={() => {
                                  setIsCustomizingTemplate(true);
                                  const t = emailTemplates.find(x => x.id === selectedTemplateId) || emailTemplates[0];
                                  setTempSubject(t.subject);
                                  setTempBody(t.body);
                                }}
                              >
                                ✏ Customize Template Layout
                              </button>
                            </div>
                            <select 
                              className="input-text text-sm" 
                              style={{ padding: '0.4rem 0.75rem', height: 'auto', border: '1px solid var(--color-border)' }}
                              value={selectedTemplateId}
                              onChange={(e) => handleTemplateChange(e.target.value)}
                            >
                              {emailTemplates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label text-xs">From (Sender)</label>
                            <input 
                              type="email" 
                              className="input-text text-sm" 
                              placeholder="Sender email address"
                              value={senderEmail}
                              onChange={(e) => setSenderEmail(e.target.value)}
                            />
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label text-xs">Recipient</label>
                            <input 
                              type="email" 
                              className="input-text text-sm" 
                              placeholder="Recipient email address"
                              value={editedEmailRecipients[activeEmailCandidateId] || ''}
                              onChange={(e) => handleUpdateDraftRecipient(activeEmailCandidateId, e.target.value)}
                            />
                          </div>
                          
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label text-xs">Subject</label>
                            <input 
                              type="text" 
                              className="input-text text-sm" 
                              placeholder="Email Subject"
                              value={editedEmailDrafts[activeEmailCandidateId].subject || ''}
                              onChange={(e) => handleUpdateDraftSubject(activeEmailCandidateId, e.target.value)}
                            />
                          </div>
                          
                          <div className="form-group flex-1" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                            <label className="form-label text-xs">Message Body</label>
                            <textarea 
                              className="input-textarea text-sm flex-1" 
                              style={{ minHeight: '180px', flex: 1 }}
                              placeholder="Write message contents here..."
                              value={editedEmailDrafts[activeEmailCandidateId].body || ''}
                              onChange={(e) => handleUpdateDraftBody(activeEmailCandidateId, e.target.value)}
                            />
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="flex justify-center items-center text-muted" style={{ height: '100%' }}>
                        Select a candidate to compose email
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-xs text-muted" style={{ fontWeight: '600' }}>
                    {selectedCandidateIds.filter(id => sentEmails[id]).length} of {selectedCandidateIds.length} Sent
                  </span>
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      onClick={() => setIsEmailModalOpen(false)}
                    >
                      Close Queue
                    </button>
                    {sentEmails[activeEmailCandidateId] ? (
                      <button 
                        type="button" 
                        className="btn-primary" 
                        style={{ width: 'auto', padding: '0.6rem 1.5rem', backgroundColor: 'var(--color-sage)' }}
                        onClick={handleNextCandidateInQueue}
                      >
                        <span>Next Candidate</span>
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        className="btn-primary" 
                        style={{ width: 'auto', padding: '0.6rem 1.5rem', backgroundColor: 'var(--color-sage)' }}
                        onClick={handleSendStepEmail}
                      >
                        <Send size={14} />
                        <span>Send Email ({candidates.find(c => c.id === activeEmailCandidateId)?.name || 'Active'})</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : sendingStatus.state === 'sending' ? (
              <div className="flex-col justify-center items-center gap-6" style={{ display: 'flex', padding: '3rem 1.5rem', textAlign: 'center', width: '100%' }}>
                <RefreshCw className="spinner" size={48} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--color-terracotta)' }} />
                <div>
                  <h3 className="modal-title" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Sending Emails...</h3>
                  <p className="text-sm text-muted">Currently dispatching email to {sendingStatus.activeName}</p>
                </div>
                <div className="w-full progress-bar-bg" style={{ height: '10px', borderRadius: '5px' }}>
                  <div className="progress-bar-fill" style={{ width: `${sendingStatus.progress}%`, height: '100%', borderRadius: '5px' }} />
                </div>
                <span className="text-xs text-muted mono-font">{sendingStatus.progress}% Completed</span>
              </div>
            ) : (
              <div className="flex-col justify-center items-center gap-6" style={{ display: 'flex', padding: '3rem 1.5rem', textAlign: 'center', width: '100%' }}>
                <div className="success-checkmark-circle">
                  <Check size={36} style={{ color: 'var(--color-sage)' }} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--color-sage)' }}>Dispatch Complete!</h3>
                  <p className="text-sm text-muted">All selected candidate emails have been queued and simulated sent successfully.</p>
                </div>
                <div className="w-full scroll-container" style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px', backgroundColor: 'var(--color-paper-light)', padding: '0.5rem' }}>
                  {Object.entries(sentEmails)
                    .map(([id, details]) => {
                      const candidate = candidates.find(c => c.id === id);
                      if (!candidate) return null;
                      return (
                        <div key={id} className="flex justify-between items-center text-xs" style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                          <span className="font-bold">{candidate.name}</span>
                          <span className="text-muted">{details.email}</span>
                          <span style={{ color: 'var(--color-sage)' }}>✓ Sent</span>
                        </div>
                      );
                    })}
                </div>
                <button 
                  type="button" 
                  className="btn-primary" 
                  style={{ width: 'auto', padding: '0.6rem 2rem', backgroundColor: 'var(--color-sage)' }}
                  onClick={() => setIsEmailModalOpen(false)}
                >
                  Close Dispatcher
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. CANDIDATE COMPARISON MODAL */}
      {isCompareModalOpen && (() => {
        const comparedCandidates = selectedCandidateIds.map(id => enrichedCandidates.find(c => c.id === id)).filter(Boolean);
        const highestScore = Math.max(...comparedCandidates.map(c => c.score || 0));
        
        return (
          <div className="modal-backdrop">
            <div className="modal-content comparison-modal" style={{ width: '950px', maxWidth: '95vw', height: '650px', maxHeight: '90vh' }}>
              <div className="modal-header">
                <h3 className="modal-title">Candidate Comparison Dashboard</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn-primary btn-print-comparison"
                    onClick={() => window.print()}
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', backgroundColor: 'var(--color-sage)', width: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem', height: '32px' }}
                  >
                    🖨️ Export PDF
                  </button>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setIsCompareModalOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-light)' }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              
              <div className="modal-body scroll-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', flex: 1 }}>
                <table className="comparison-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ textAlign: 'left', padding: '1rem 0.5rem' }}>ATS Match Dimension</th>
                      {comparedCandidates.map(candidate => {
                        const isTop = candidate.score === highestScore && comparedCandidates.length > 1;
                        return (
                          <th key={candidate.id} style={{ minWidth: '180px', textAlign: 'center', padding: '1rem 0.5rem' }}>
                            {isTop && (
                              <span className="candidate-verdict shortlisted animate-pulse" style={{ backgroundColor: 'var(--color-terracotta-light)', color: 'var(--color-terracotta)', border: '1px solid rgba(200, 90, 50, 0.25)', marginBottom: '0.4rem', display: 'inline-block', padding: '0.2rem 0.5rem', fontSize: '0.65rem', fontWeight: 'bold', borderRadius: '4px' }}>
                                ★ Best Fit Match
                              </span>
                            )}
                            <span style={{ fontSize: '1.1rem', display: 'block', fontWeight: '800' }}>{candidate.name}</span>
                            <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--color-ink-muted)', marginTop: '0.15rem' }}>{candidate.fileName}</span>
                            <span className={`candidate-verdict ${getNextStepDetails(candidate.score, threshold).badgeClass}`} style={{ marginTop: '0.4rem', display: 'inline-block', padding: '0.15rem 0.5rem', fontSize: '0.65rem' }}>
                              {getNextStepDetails(candidate.score, threshold).badge}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Overall Score Row */}
                    <tr style={{ backgroundColor: 'var(--color-paper-light)', fontWeight: 'bold', borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem 0.5rem' }}>Overall Alignment Score</td>
                      {comparedCandidates.map(candidate => {
                        return (
                          <td key={candidate.id} style={{ textAlign: 'center', padding: '1rem 0.5rem' }}>
                            <span style={{ fontSize: '1.8rem', color: 'var(--color-terracotta)', fontFamily: 'var(--font-mono)' }}>{candidate.score}</span>
                            <span style={{ fontSize: '0.8rem', display: 'block', color: 'var(--color-ink-muted)', fontWeight: 'normal' }}>out of 100</span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Skills Score Row */}
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <strong>Skills Match (30%)</strong>
                        <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 'normal' }}>Core tools and libraries alignment</span>
                      </td>
                      {comparedCandidates.map(candidate => {
                        const score = candidate.evaluation?.subscores?.skills || 75;
                        return (
                          <td key={candidate.id} style={{ padding: '1rem 0.5rem' }}>
                            <div className="flex-col gap-1" style={{ display: 'flex' }}>
                              <div className="flex justify-between text-xs font-semibold">
                                <span>Score: {score}</span>
                              </div>
                              <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${score}%` }} />
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Experience Score Row */}
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <strong>Experience & Tenure (25%)</strong>
                        <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 'normal' }}>Years of work, senior titles match</span>
                      </td>
                      {comparedCandidates.map(candidate => {
                        const score = candidate.evaluation?.subscores?.experience || 75;
                        return (
                          <td key={candidate.id} style={{ padding: '1rem 0.5rem' }}>
                            <div className="flex-col gap-1" style={{ display: 'flex' }}>
                              <div className="flex justify-between text-xs font-semibold">
                                <span>Score: {score}</span>
                              </div>
                              <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${score}%` }} />
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Industry Match Row */}
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <strong>Industry Domain (10%)</strong>
                        <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 'normal' }}>Fintech, SaaS, Healthcare background</span>
                      </td>
                      {comparedCandidates.map(candidate => {
                        const score = candidate.evaluation?.subscores?.industry || 75;
                        return (
                          <td key={candidate.id} style={{ padding: '1rem 0.5rem' }}>
                            <div className="flex-col gap-1" style={{ display: 'flex' }}>
                              <div className="flex justify-between text-xs font-semibold">
                                <span>Score: {score}</span>
                              </div>
                              <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${score}%` }} />
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Projects Row */}
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <strong>Projects & Execution (10%)</strong>
                        <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 'normal' }}>GitHub, scale, and delivery keywords</span>
                      </td>
                      {comparedCandidates.map(candidate => {
                        const score = candidate.evaluation?.subscores?.projects || 75;
                        return (
                          <td key={candidate.id} style={{ padding: '1rem 0.5rem' }}>
                            <div className="flex-col gap-1" style={{ display: 'flex' }}>
                              <div className="flex justify-between text-xs font-semibold">
                                <span>Score: {score}</span>
                              </div>
                              <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${score}%` }} />
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Education Match Row */}
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <strong>Education Degree (5%)</strong>
                        <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 'normal' }}>Academic alignment (BSc, Master, PhD)</span>
                      </td>
                      {comparedCandidates.map(candidate => {
                        const score = candidate.evaluation?.subscores?.education || 75;
                        return (
                          <td key={candidate.id} style={{ padding: '1rem 0.5rem' }}>
                            <div className="flex-col gap-1" style={{ display: 'flex' }}>
                              <div className="flex justify-between text-xs font-semibold">
                                <span>Score: {score}</span>
                              </div>
                              <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${score}%` }} />
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Communication Match Row */}
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <strong>Communication & Clarity (10%)</strong>
                        <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 'normal' }}>Use of action verbs, bullet density</span>
                      </td>
                      {comparedCandidates.map(candidate => {
                        const score = candidate.evaluation?.subscores?.communication || 75;
                        return (
                          <td key={candidate.id} style={{ padding: '1rem 0.5rem' }}>
                            <div className="flex-col gap-1" style={{ display: 'flex' }}>
                              <div className="flex justify-between text-xs font-semibold">
                                <span>Score: {score}</span>
                              </div>
                              <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${score}%` }} />
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Growth Indicators Row */}
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <strong>Growth & Leadership (10%)</strong>
                        <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 'normal' }}>Mentoring, promotions, certifications</span>
                      </td>
                      {comparedCandidates.map(candidate => {
                        const score = candidate.evaluation?.subscores?.growth || 75;
                        return (
                          <td key={candidate.id} style={{ padding: '1rem 0.5rem' }}>
                            <div className="flex-col gap-1" style={{ display: 'flex' }}>
                              <div className="flex justify-between text-xs font-semibold">
                                <span>Score: {score}</span>
                              </div>
                              <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${score}%` }} />
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Location Row */}
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <strong>Location</strong>
                        <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 'normal' }}>Current candidate location</span>
                      </td>
                      {comparedCandidates.map(candidate => {
                        return (
                          <td key={candidate.id} style={{ textAlign: 'center', padding: '1rem 0.5rem' }}>
                            <span style={{ fontWeight: '600' }}>{candidate.evaluation?.location || candidate.location || 'Bangalore'}</span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Notice Period Row */}
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <strong>Notice Period</strong>
                        <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 'normal' }}>Availability/joining timeline</span>
                      </td>
                      {comparedCandidates.map(candidate => {
                        const np = candidate.evaluation?.notice_period || candidate.noticePeriod || 'Immediate';
                        return (
                          <td key={candidate.id} style={{ textAlign: 'center', padding: '1rem 0.5rem' }}>
                            <span className="keyword-chip matched" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', display: 'inline-block' }}>
                              {np}
                            </span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Expected CTC Row */}
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <strong>Expected CTC</strong>
                        <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 'normal' }}>Salary expectation in LPA</span>
                      </td>
                      {comparedCandidates.map(candidate => {
                        return (
                          <td key={candidate.id} style={{ textAlign: 'center', padding: '1rem 0.5rem' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--color-terracotta)', fontSize: '1.1rem' }}>
                              {candidate.evaluation?.expected_ctc || candidate.expectedCtc || 0} LPA
                            </span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Scorecard Average Ratings Row */}
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <strong>Collaborator Reviews</strong>
                        <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 'normal' }}>Averaged scorecard stars</span>
                      </td>
                      {comparedCandidates.map(candidate => {
                        const ratings = candidate.collaboratorRatings || {
                          recruiter: candidate.scorecard || { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3 },
                          technical: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3 },
                          hr: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3 }
                        };
                        
                        const avg = (role) => {
                          const card = ratings[role] || { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3 };
                          return ((card.technical + card.communication + card.problemSolving + card.cultureFit) / 4).toFixed(1);
                        };
                        
                        return (
                          <td key={candidate.id} style={{ padding: '1rem 0.5rem', fontSize: '0.8rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
                              <span>Recruiter Screen: <strong>{avg('recruiter')} ★</strong></span>
                              <span>Tech Interviewer: <strong>{avg('technical')} ★</strong></span>
                              <span>HR Fit Round: <strong>{avg('hr')} ★</strong></span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Key Match Summary Phrases */}
                    <tr style={{ backgroundColor: 'var(--color-paper-light)' }}>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <strong>Recruiter Summary</strong>
                        <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 'normal' }}>Offline match engine overview</span>
                      </td>
                      {comparedCandidates.map(candidate => {
                        return (
                          <td key={candidate.id} style={{ fontSize: '0.85rem', fontStyle: 'italic', padding: '1rem', color: 'var(--color-ink-light)' }}>
                            "{candidate.evaluation?.summary || 'No evaluation'}"
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn-primary" 
                  style={{ width: 'auto', padding: '0.6rem 2rem', backgroundColor: 'var(--color-sage)' }}
                  onClick={() => setIsCompareModalOpen(false)}
                >
                  Close Comparison
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

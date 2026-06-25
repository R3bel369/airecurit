import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileText, Check, AlertCircle, Copy, Settings, Sparkles, 
  Trash2, Eye, EyeOff, CheckCircle, RefreshCw, AlertTriangle, ChevronDown, ChevronUp,
  Mail, Send, X, Sun, Moon, Briefcase, Globe, Users, Target, TrendingUp, Zap, DollarSign,
  LogOut, Lock, LayoutDashboard, User, Bookmark, Star, ClipboardList, Award, Calendar,
  FileCheck, Folder, MessageSquare, Bell, Bot, FolderOpen, ChevronLeft, ChevronRight, BookOpen, Search,
  Linkedin, Share2, ExternalLink, BarChart2, Download
} from 'lucide-react';




import { supabase } from './supabase';

const CANDIDATE_COLUMNS = [
  'id', 'name', 'fileName', 'fileSize', 'status', 'ocrProgress',
  'text', 'numChars', 'errorDetails', 'score', 'stage', 'noticePeriod',
  'currentCtc', 'expectedCtc', 'location', 'preferredLocation',
  'resumeQuality', 'evaluation', 'scorecard', 'activityLog', 'jobsData',
  'created_at'
];

const sanitizeCandidate = (c) => {
  if (!c) return c;
  const sanitized = {};
  CANDIDATE_COLUMNS.forEach(col => {
    if (c[col] !== undefined) {
      sanitized[col] = c[col];
    }
  });
  return sanitized;
};

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

  // ─── 1. Parse Must-Have items into named requirements ────────────────────────
  const parseMustHaveItems = (mhText) => {
    if (!mhText || !mhText.trim()) return [];
    return mhText.split(/[,;\n]+/).map(s => s.trim()).filter(s => s.length > 1).map(raw => {
      const synonyms = [raw.toLowerCase()];
      const synMap = {
        'react': ['react.js', 'reactjs'], 'node': ['node.js', 'nodejs'],
        'next.js': ['nextjs', 'next js'], 'vue': ['vue.js', 'vuejs'],
        'angular': ['angularjs', 'angular.js'], 'typescript': ['ts', 'tsx'],
        'javascript': ['js', 'ecmascript', 'es6'], 'python': ['py'],
        'aws': ['amazon web services'], 'gcp': ['google cloud platform', 'google cloud'],
        'kubernetes': ['k8s'], 'ci/cd': ['cicd', 'continuous integration', 'continuous delivery'],
        'postgresql': ['postgres', 'psql'], 'machine learning': ['ml', 'ai/ml'],
        'agile': ['scrum', 'agile methodology'], 'rest api': ['restful', 'rest apis'],
        'graphql': ['graph ql'], 'docker': ['containerization'],
        'tailwind': ['tailwind css', 'tailwindcss'], 'sass': ['scss'],
        'sql': ['structured query language'], 'nlp': ['natural language processing'],
        'pytorch': ['torch'], 'tensorflow': ['tf', 'keras'],
        'spring boot': ['spring framework'],
      };
      const lowerRaw = raw.toLowerCase().trim();
      for (const [key, vals] of Object.entries(synMap)) {
        if (lowerRaw.includes(key) || vals.some(v => lowerRaw.includes(v))) synonyms.push(key, ...vals);
      }
      const expMatch = raw.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
      return { label: raw, synonyms: [...new Set(synonyms)], isExperienceReq: !!expMatch, requiredExpYears: expMatch ? parseInt(expMatch[1]) : null };
    });
  };
  const mustHaveItems = parseMustHaveItems(mustHaves);

  // ─── 2. Candidate experience years ───────────────────────────────────────────
  let candidateYears = 0;
  const candExpRegex = /\b(\d{1,2})\+?\s*(?:years?|yrs?)\b/g;
  let matchCand;
  while ((matchCand = candExpRegex.exec(candidateTextLower)) !== null) {
    const v = parseInt(matchCand[1]);
    if (v > candidateYears && v < 40) candidateYears = v;
  }
  if (/director|vp|vice president|head of/i.test(candidateTextLower))                  candidateYears = Math.max(candidateYears, 12);
  else if (/principal|architect|lead engineer|lead developer/i.test(candidateTextLower)) candidateYears = Math.max(candidateYears, 8);
  else if (/senior|sr\./i.test(candidateTextLower))                                     candidateYears = Math.max(candidateYears, 5);
  else if (/junior|jr\.|intern|entry/i.test(candidateTextLower))                        candidateYears = Math.max(candidateYears, 1);
  if (candidateYears === 0) candidateYears = 2;

  // ─── 3. Evaluate each Must-Have requirement ───────────────────────────────────
  const mustHaveResults = mustHaveItems.map(item => {
    if (item.isExperienceReq) {
      const met = candidateYears >= item.requiredExpYears;
      return { label: item.label, met, reason: met ? `Has ${candidateYears} yrs (req: ${item.requiredExpYears}+)` : `Has ${candidateYears} yrs (req: ${item.requiredExpYears}+)`, isExperienceReq: true };
    }
    const found = item.synonyms.some(syn => {
      if (/[+#]/.test(syn)) return new RegExp('(^|\\s)' + escapeRegExp(syn) + '(\\s|$|\\.)', 'i').test(candidateTextLower);
      return new RegExp('\\b' + escapeRegExp(syn) + '\\b', 'i').test(candidateTextLower);
    });
    return { label: item.label, met: found, reason: found ? 'Found in resume' : 'Not found in resume', isExperienceReq: false };
  });

  const mustHaveMet   = mustHaveResults.filter(r => r.met).length;
  const mustHaveTotal = mustHaveResults.length;
  const mustHavePct   = mustHaveTotal > 0 ? mustHaveMet / mustHaveTotal : 1;
  const missingMustHaves = mustHaveResults.filter(r => !r.met).map(r => r.label);

  // ─── 4. JD keyword matching ───────────────────────────────────────────────────
  const jdKeywords = extractKeywords(jobDescription, mustHaves);
  const matched = [], missing = [];
  jdKeywords.forEach(kw => {
    const pat = /[+#]/.test(kw)
      ? new RegExp('(^|\\s)' + escapeRegExp(kw) + '(\\s|$|\\.)', 'i')
      : new RegExp('\\b' + escapeRegExp(kw) + '\\b', 'i');
    pat.test(candidateTextLower) ? matched.push(kw) : missing.push(kw);
  });

  // ─── 5. Required experience from JD text ──────────────────────────────────────
  const expRegex2 = /\b(\d{1,2})\+?\s*(?:years?|yrs?)\b/g;
  let expM2; let requiredYears = 0;
  while ((expM2 = expRegex2.exec(jdLower)) !== null) { const v = parseInt(expM2[1]); if (v > requiredYears && v < 20) requiredYears = v; }
  if (requiredYears === 0) requiredYears = /lead|senior|architect|principal|manager/i.test(jobTitle + ' ' + jobDescription) ? 5 : 2;

  // ─── 6. Sub-scores ────────────────────────────────────────────────────────────
  const mustHaveScore   = mustHaveTotal === 0 ? 90 : Math.round(mustHavePct * 100);
  const skillsScore     = jdKeywords.length === 0 ? 80 : Math.round(45 + (matched.length / jdKeywords.length) * 55);
  const diff            = candidateYears - requiredYears;
  const experienceScore = diff >= 0 ? Math.min(100, 80 + diff * 4) : Math.max(30, 70 + diff * 10);
  const eduLevel        = s => /ph\.?d|doctorate/i.test(s) ? 5 : /master|m\.?s\.?|m\.?tech|mba/i.test(s) ? 4 : /bachelor|b\.?s\.?|b\.?tech|b\.?e\.?/i.test(s) ? 3 : /associate|diploma/i.test(s) ? 2 : /university|college|school/i.test(s) ? 1 : 0;
  const candEduW        = eduLevel(candidateTextLower);
  const jdEduReqStr     = /ph\.?d|doctorate/i.test(jdLower) ? 'phd' : /master|m\.?s\.?|mba/i.test(jdLower) ? 'master' : /degree|bachelor|b\.?s\.?/i.test(jdLower) ? 'bachelor' : 'none';
  const jdEduW          = { phd: 5, master: 4, bachelor: 3, associate: 2, college: 1, none: 0 }[jdEduReqStr] || 0;
  const educationScore  = candEduW >= jdEduW ? (candEduW > jdEduW ? 95 : 85) : Math.max(45, 80 - (jdEduW - candEduW) * 15);

  const actionVerbs = ['spearheaded','orchestrated','engineered','streamlined','optimized','managed','designed','built','implemented','led','developed','coordinated','architected','delivered','improved','increased','reduced'];
  let actionVerbCount = 0;
  actionVerbs.forEach(v => { actionVerbCount += (candidateTextLower.match(new RegExp('\\b' + v + '\\b', 'gi')) || []).length; });
  const bulletCount  = (candidateTextLower.match(/[•\-\*]/g) || []).length;
  const charCount    = candidateTextLower.length;
  const sizeScore    = charCount < 400 ? 40 : charCount > 15000 ? 70 : 95;
  const qualityScore = Math.round(sizeScore * 0.4 + Math.min(100, actionVerbCount * 3) * 0.35 + Math.min(100, bulletCount * 1.5) * 0.25);

  const growthWords = ['promoted','progression','certified','certification','mentored','leadership','initiative','exceeded'];
  let growthCount = 0;
  growthWords.forEach(w => { growthCount += (candidateTextLower.match(new RegExp('\\b' + w + '\\b', 'gi')) || []).length; });
  const growthScore = Math.min(100, Math.max(50, 60 + growthCount * 5));

  // ─── 7. Raw weighted score (Must-Haves carry 35%) ────────────────────────────
  const rawScore = Math.round(
    mustHaveScore   * 0.35 +
    skillsScore     * 0.25 +
    experienceScore * 0.20 +
    educationScore  * 0.05 +
    qualityScore    * 0.10 +
    growthScore     * 0.05
  );

  // ─── 8. Must-Have Gate — hard score cap decides fate ─────────────────────────
  let calculatedScore = rawScore;
  let gateStatus = 'pass';
  let gateReason = '';
  if (mustHaveTotal > 0) {
    if (mustHavePct < 0.34) {
      calculatedScore = Math.min(rawScore, 52);
      gateStatus = 'hard_fail';
      gateReason = `Failed ${mustHaveTotal - mustHaveMet}/${mustHaveTotal} must-haves (${Math.round((1-mustHavePct)*100)}% miss rate). Hard-capped at 52 — recommend decline.`;
    } else if (mustHavePct < 0.60) {
      calculatedScore = Math.min(rawScore, 67);
      gateStatus = 'soft_fail';
      gateReason = `Missing ${mustHaveTotal - mustHaveMet}/${mustHaveTotal} must-haves. Capped at 67 — borderline, phone screen recommended.`;
    } else if (mustHavePct < 0.80) {
      calculatedScore = Math.min(rawScore, 79);
      gateStatus = 'partial';
      gateReason = `Met ${mustHaveMet}/${mustHaveTotal} must-haves. Minor gaps — score capped at 79.`;
    } else {
      gateStatus = 'pass';
      gateReason = `Met ${mustHaveMet}/${mustHaveTotal} must-haves — no cap applied.`;
    }
  }
  calculatedScore = Math.max(25, Math.min(100, calculatedScore));

  // ─── 9. Fate verdict ─────────────────────────────────────────────────────────
  const cleanedName = formatName(candidate.name);
  let fateLevel = 'Not a Fit';
  let summaryText = '';
  if (calculatedScore >= 80) {
    fateLevel = 'Shortlist';
    summaryText = `${cleanedName} is a strong match. They satisfy ${mustHaveMet}/${mustHaveTotal} must-haves, bring ${candidateYears} yrs of experience (${requiredYears}+ required), and match ${matched.length}/${jdKeywords.length} JD keywords. Recommended for immediate interview.`;
  } else if (calculatedScore >= 70) {
    fateLevel = 'Shortlist';
    summaryText = `${cleanedName} meets the minimum bar: ${mustHaveMet}/${mustHaveTotal} must-haves satisfied, ${candidateYears} yrs experience, ${Math.round((matched.length/Math.max(jdKeywords.length,1))*100)}% keyword coverage. Recommend technical screening.`;
  } else if (calculatedScore >= 60) {
    fateLevel = 'Borderline';
    summaryText = `${cleanedName} partially meets requirements. Missing must-haves: ${missingMustHaves.slice(0,3).join(', ')||'none'}. Exp: ${candidateYears}/${requiredYears} yrs. Phone screen recommended to clarify gaps.`;
  } else if (calculatedScore >= 50) {
    fateLevel = 'Not a Fit';
    summaryText = `${cleanedName} falls below threshold. Missing critical must-haves: ${missingMustHaves.slice(0,3).join(', ')}. Only ${mustHaveMet}/${mustHaveTotal} requirements met with ${candidateYears} yrs experience.`;
  } else {
    fateLevel = 'Reject';
    summaryText = `${cleanedName} does not meet requirements. Only ${mustHaveMet}/${mustHaveTotal} must-haves satisfied. Insufficient alignment — recommend declining.`;
  }

  // ─── 10. Strengths & Risks tied to JD requirements ───────────────────────────
  const strengths = [];
  const risks = [];
  if (mustHavePct >= 0.8)    strengths.push(`Satisfies ${mustHaveMet}/${mustHaveTotal} must-have requirements — strong JD alignment.`);
  if (experienceScore >= 80)  strengths.push(`${candidateYears} yrs experience meets/exceeds the ${requiredYears}+ yr requirement.`);
  if (skillsScore >= 80)      strengths.push(`High JD keyword coverage: ${matched.length}/${jdKeywords.length} skills matched (${matched.slice(0,3).join(', ')}).`);
  if (growthScore >= 80)      strengths.push(`Resume shows career progression, leadership, or active certifications.`);
  if (qualityScore >= 80)     strengths.push(`Well-structured resume with strong action verbs and achievements.`);
  while (strengths.length < 2) strengths.push(`Practical implementation experience and domain exposure detected.`);

  if (missingMustHaves.length > 0) risks.push(`🚨 Missing must-have(s): ${missingMustHaves.slice(0,3).join(', ')}.`);
  if (diff < -1)               risks.push(`Experience gap: ${candidateYears} yrs vs ${requiredYears} required — ${Math.abs(diff)} yr(s) short.`);
  if (missing.length > 3)      risks.push(`${missing.length} JD keywords absent from resume: ${missing.slice(0,3).join(', ')}.`);
  if (qualityScore < 60)       risks.push(`Resume lacks quantified achievements or action-oriented language.`);
  if (risks.length === 0)      risks.push(`Validate depth in ${matched.slice(0,2).join(', ')||'core technologies'} during interview.`);

  // ─── 11. Targeted interview questions ────────────────────────────────────────
  const interviewQuestions = [
    {
      type: 'Must-Have Probe',
      question: missingMustHaves.length > 0
        ? `Your resume doesn't explicitly show "${missingMustHaves[0]}" — a core requirement. Can you describe your hands-on experience with it, or the closest equivalent?`
        : `You meet all key requirements. Describe a complex challenge using "${matched[0]||'your primary stack'}" — what was the hardest technical decision you made?`,
      skill: missingMustHaves[0] || (matched[0] || 'core requirement')
    },
    {
      type: 'Experience Depth Probe',
      question: `This role requires ${requiredYears}+ years of relevant experience. Walk us through your most technically demanding project in the last ${Math.min(candidateYears, 3)} years — your specific contribution and the business impact.`,
      skill: `${candidateYears} yrs vs ${requiredYears}+ required`
    },
    {
      type: 'Skill Validation Probe',
      question: matched.length > 0
        ? `You've listed "${matched[0]}". Give a concrete production-level example — scale, architecture, and lessons learned.`
        : `How would you approach learning "${missing[0]||'a new technology'}" if required? What is your learning process?`,
      skill: matched[0] || (missing[0] || 'core skill')
    }
  ];

  // ─── 12. Inferred logistics ───────────────────────────────────────────────────
  const noticePeriod     = candidate.noticePeriod     || inferNoticePeriod(candidateTextLower, candidateYears);
  const currentCtc       = candidate.currentCtc        || inferCurrentCtc(candidateYears);
  const expectedCtc      = candidate.expectedCtc       || inferExpectedCtc(currentCtc);
  const location         = candidate.location          || inferLocation(candidateTextLower);
  const preferredLocation = candidate.preferredLocation || `${location}, Remote`;
  const resumeQuality    = candidate.resumeQuality     || Math.min(100, qualityScore);
  const scorecard        = candidate.scorecard         || { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: '' };
  const timeStr = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const activityLog = candidate.activityLog || [
    { id: 1, type: 'applied',  text: 'Profile added to screening queue', timestamp: timeStr },
    { id: 2, type: 'screened', text: `ATS Screen: ${calculatedScore}/100 | Must-Haves: ${mustHaveMet}/${mustHaveTotal} | Gate: ${gateStatus}`, timestamp: timeStr }
  ];

  return {
    candidate_name:      cleanedName,
    summary:             summaryText,
    fate_level:          fateLevel,
    gate_status:         gateStatus,
    gate_reason:         gateReason,
    must_have_results:   mustHaveResults,
    must_have_met:       mustHaveMet,
    must_have_total:     mustHaveTotal,
    must_have_pct:       Math.round(mustHavePct * 100),
    subscores: {
      'Must-Haves':      mustHaveScore,
      'JD Skills':       skillsScore,
      'Experience':      experienceScore,
      'Education':       educationScore,
      'Resume Quality':  qualityScore,
      'Growth':          growthScore
    },
    calculatedScore,
    required_years:      requiredYears,
    candidate_years:     candidateYears,
    matched_keywords:    matched,
    missing_keywords:    missing,
    strengths,
    risks,
    next_step_reason:    `Score ${calculatedScore}/100 | Must-Haves ${mustHaveMet}/${mustHaveTotal} | Exp ${candidateYears}/${requiredYears}yr | Gate: ${gateStatus}`,
    notice_period:       noticePeriod,
    current_ctc:         currentCtc,
    expected_ctc:        expectedCtc,
    location,
    preferred_location:  preferredLocation,
    resume_quality:      resumeQuality,
    scorecard,
    activity_log:        activityLog,
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

const QUIZ_QUESTIONS = {
  1: [
    { q: "What is the output of typeof NaN?", options: ["'number'", "'NaN'", "'undefined'", "'object'"], answer: 0 },
    { q: "Which JS method creates a new filtered array?", options: ["map()", "filter()", "reduce()", "forEach()"], answer: 1 },
    { q: "What is Promise.all()'s default behavior?", options: ["Runs sequentially", "Resolves when all resolve, rejects when any rejects", "Returns first resolved", "Cancels other promises"], answer: 1 }
  ],
  2: [
    { q: "What is the primary benefit of a CDN?", options: ["Increase web server CPU load", "Cache static content closer to users to reduce latency", "Encrypt database records", "Generate serverless APIs"], answer: 1 },
    { q: "Which caching strategy writes to both cache and db simultaneously?", options: ["Write-through", "Write-back", "Cache-aside", "Read-through"], answer: 0 },
    { q: "What is horizontal scaling?", options: ["Adding more resources to one server", "Adding more server nodes to the cluster", "Optimizing query execution plan", "Converting code to serverless"], answer: 1 }
  ]
};

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
  // Authentication states
  const [session, setSession] = useState(null);
  const userRole = session?.user?.user_metadata?.role || (session?.user?.email === 'admink338@gmail.com' ? 'admin' : 'candidate');
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginRole, setLoginRole] = useState('candidate'); // 'admin' | 'candidate'
  const [loginMode, setLoginMode] = useState('login'); // 'login' | 'register'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Email and Password are required.');
      return;
    }
    setLoginError(null);
    setIsSigningIn(true);
    try {
      if (loginMode === 'register') {
        // Candidate or Admin registration
        const { data, error } = await supabase.auth.signUp({
          email: loginEmail,
          password: loginPassword,
          options: {
            data: {
              role: loginRole, // 'candidate' or 'admin'
            }
          }
        });
        if (error) {
          if (error.message?.toLowerCase().includes('already registered') || error.message?.toLowerCase().includes('already exists')) {
            setLoginError('An account with this email address already exists. Please sign in instead.');
          } else {
            setLoginError(error.message || 'Registration failed. Try a different email.');
          }
        } else if (data.session) {
          // Email confirmation disabled — logged in immediately
          setSession(data.session);
          setLoginEmail('');
          setLoginPassword('');
        } else {
          // Email confirmation required OR account already exists — try direct sign-in
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password: loginPassword,
          });
          if (signInData?.session) {
            const signedInUser = signInData.user;
            const actualRole = signedInUser?.user_metadata?.role || (signedInUser?.email === 'admink338@gmail.com' ? 'admin' : 'candidate');
            
            if (loginRole === 'admin' && actualRole !== 'admin') {
              setLoginError('Candidate accounts cannot log in as an HR Recruiter.');
              await supabase.auth.signOut();
            } else if (loginRole === 'candidate' && actualRole === 'admin') {
              setLoginError('Admin accounts cannot log in as a Job Candidate.');
              await supabase.auth.signOut();
            } else {
              setSession(signInData.session);
              setLoginEmail('');
              setLoginPassword('');
            }
          } else {
            // Switch to login mode and show success
            setLoginMode('login');
            setLoginError(null);
            alert('✅ Account created! Please sign in with your credentials.');
          }
        }
      } else {
        // Sign in (admin or candidate)
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword,
        });
        if (error) {
          if (error.message?.toLowerCase().includes('email not confirmed')) {
            setLoginError('Your email address is not confirmed yet. Please verify your email by clicking the confirmation link sent to your inbox.');
          } else if (error.message?.toLowerCase().includes('invalid login credentials')) {
            setLoginError('Invalid email or password. Please verify your credentials and try again.');
          } else {
            setLoginError(error.message || 'Invalid login credentials.');
          }
        } else {
          const signedInUser = data.user;
          const actualRole = signedInUser?.user_metadata?.role || (signedInUser?.email === 'admink338@gmail.com' ? 'admin' : 'candidate');
          
          if (loginRole === 'admin' && actualRole !== 'admin') {
            setLoginError('Candidate accounts cannot log in as an HR Recruiter.');
            await supabase.auth.signOut();
          } else if (loginRole === 'candidate' && actualRole === 'admin') {
            setLoginError('Admin accounts cannot log in as a Job Candidate.');
            await supabase.auth.signOut();
          } else {
            setSession(data.session);
            setLoginEmail('');
            setLoginPassword('');
          }
        }
      }
    } catch (err) {
      setLoginError('Failed to sign in. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (supabaseStatus !== 'offline') {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setSession(null);
    }
  };

  const handleCandidateAuth = async (e) => {
    e.preventDefault();
    if (!candidateEmail.trim() || !candidatePassword.trim()) {
      setCandidateAuthError('Email and Password are required.');
      return;
    }
    setCandidateAuthError(null);
    setCandidateAuthLoading(true);

    try {
      if (candidateAuthMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: candidateEmail,
          password: candidatePassword,
        });
        if (error) {
          setCandidateAuthError(error.message || 'Invalid login credentials.');
        } else {
          setIsCandidateAuthOpen(false);
          setCandidateEmail('');
          setCandidatePassword('');
        }
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: candidateEmail,
          password: candidatePassword,
          options: {
            data: {
              role: 'candidate'
            }
          }
        });
        if (error) {
          setCandidateAuthError(error.message || 'Registration failed.');
        } else if (signUpData.session) {
          setIsCandidateAuthOpen(false);
          setCandidateEmail('');
          setCandidatePassword('');
        } else {
          // Try immediate sign-in after signup
          const { data: siData } = await supabase.auth.signInWithPassword({
            email: candidateEmail, password: candidatePassword
          });
          if (siData?.session) {
            setIsCandidateAuthOpen(false);
            setCandidateEmail('');
            setCandidatePassword('');
          } else {
            alert('✅ Account created! Please sign in with your credentials.');
            setCandidateAuthMode('login');
          }
        }
      }
    } catch (err) {
      setCandidateAuthError('An error occurred. Please try again.');
    } finally {
      setCandidateAuthLoading(false);
    }
  };

  const handleAssistantSubmit = (e, overrideQuery = null) => {
    if (e) e.preventDefault();
    const query = (overrideQuery || assistantInput).trim();
    if (!query) return;

    // Add user message
    const userMsg = {
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setAssistantMessages(prev => [...prev, userMsg]);
    if (!overrideQuery) setAssistantInput('');

    // Process Response (Offline NLP parser)
    setTimeout(() => {
      let replyText = '';
      const cleanQuery = query.toLowerCase();

      if (cleanQuery.includes('best') || cleanQuery.includes('highest') || cleanQuery.includes('top')) {
        // Find best candidate
        const sorted = [...enrichedCandidates].sort((a, b) => (b.score || 0) - (a.score || 0));
        if (sorted.length > 0 && sorted[0].score) {
          replyText = `The highest-fitting candidate is **${sorted[0].name}** with an overall score of **${sorted[0].score}/100** matching your job description: "${jobTitle}". Would you like to draft an interview invite for them?`;
        } else {
          replyText = "There are no evaluated candidates in the screening queue yet. Please screen uploaded resumes first!";
        }
      } 
      else if (cleanQuery.includes('immediate') || cleanQuery.includes('joiner') || cleanQuery.includes('notice')) {
        // Find immediate joiners
        const immediates = enrichedCandidates.filter(c => {
          const np = c.evaluation?.notice_period || c.noticePeriod || '';
          return np.toLowerCase().includes('immediate');
        });
        if (immediates.length > 0) {
          replyText = `I found **${immediates.length}** immediate joiner(s):\n` + 
            immediates.map(c => `• **${c.name}** (Expected: ${c.evaluation?.expected_ctc || c.expectedCtc} LPA, Location: ${c.evaluation?.location || c.location})`).join('\n') +
            `\nThese profiles are highlighted and ready for contact!`;
        } else {
          replyText = "I couldn't find any candidates with an immediate notice period in the active list.";
        }
      } 
      else if (cleanQuery.includes('react') || cleanQuery.includes('frontend') || cleanQuery.includes('typescript') || cleanQuery.includes('javascript')) {
        // Filter by frontend skills
        const keyword = cleanQuery.includes('react') ? 'react' : cleanQuery.includes('typescript') ? 'typescript' : cleanQuery.includes('javascript') ? 'javascript' : 'frontend';
        const matches = enrichedCandidates.filter(c => {
          const text = (c.text || '').toLowerCase();
          return text.includes(keyword);
        });
        if (matches.length > 0) {
          replyText = `Found **${matches.length}** candidate(s) with **${keyword}** in their resume:\n` + 
            matches.map(c => `• **${c.name}** (ATS Match: ${c.score || 'Not Screened'}%)`).join('\n') +
            `\nYou can use the search filter on the Candidates Manager tab to narrow this list further.`;
        } else {
          replyText = `No candidates in the current list mention "${keyword}" in their resume texts.`;
        }
      }
      else if (cleanQuery.includes('summarize') || cleanQuery.includes('summary')) {
        // Summarize a specific candidate
        let foundCandidate = null;
        for (const c of enrichedCandidates) {
          if (cleanQuery.includes(c.name.toLowerCase().split(' ')[0])) {
            foundCandidate = c;
            break;
          }
        }
        if (!foundCandidate && enrichedCandidates.length > 0) {
          foundCandidate = enrichedCandidates[0]; // fallback to first
        }

        if (foundCandidate) {
          const strengths = foundCandidate.evaluation?.strengths || ['Practical industry background'];
          const risks = foundCandidate.evaluation?.risks || ['No major risks highlighted'];
          replyText = `Here is a summary for **${foundCandidate.name}** (ATS Score: **${foundCandidate.score || 'N/A'}/100**):\n\n` +
            `**Key Strengths:**\n` + strengths.map(s => `• ${s}`).join('\n') + `\n\n` +
            `**Potential Risks:**\n` + risks.map(r => `• ${r}`).join('\n') + `\n\n` +
            `**Logistics:** Location is ${foundCandidate.evaluation?.location || foundCandidate.location}, expected CTC is ${foundCandidate.evaluation?.expected_ctc || foundCandidate.expectedCtc} LPA with a ${foundCandidate.evaluation?.notice_period || foundCandidate.noticePeriod} notice period.`;
        } else {
          replyText = "I couldn't identify which candidate you'd like me to summarize. Please specify their first name!";
        }
      }
      else if (cleanQuery.includes('email') || cleanQuery.includes('draft') || cleanQuery.includes('outreach')) {
        // Draft an email for first candidate
        const candidate = enrichedCandidates[0] || { name: 'Candidate', evaluation: { expected_ctc: 12 } };
        replyText = `I have drafted an outreach template for **${candidate.name}**:\n\n` +
          `*Subject: Application Update - ${jobTitle}*\n\n` +
          `Dear ${candidate.name},\n` +
          `Thank you for applying to the ${jobTitle} role. We reviewed your resume and were impressed by your background. We would like to schedule a 30-minute introductory interview. Please let us know your availability.\n\n` +
          `Best regards,\nRecruiterPro Team`;
      }
      else {
        replyText = "I understand! I can help you search the candidate pool. Try asking:\n" +
          "• *'Who is the best candidate?'*\n" +
          "• *'Show me immediate joiners'*\n" +
          "• *'Who has React experience?'*\n" +
          "• *'Summarize Rohan Mehta'*\n" +
          "• *'Draft an outreach email'*";
      }

      setAssistantMessages(prev => [...prev, {
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 800);
  };

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
  const [maxExpectedCtc, setMaxExpectedCtc] = useState(60);
  const [noticePeriodFilter, setNoticePeriodFilter] = useState('any');
  const [locationFilter, setLocationFilter] = useState('');

  // Extended filter & sort states
  const [sortBy, setSortBy] = useState('score_desc'); // 'score_desc' | 'score_asc' | 'name_asc' | 'ctc_asc' | 'ctc_desc' | 'notice_asc'
  const [stageFilter, setStageFilter] = useState('all'); // 'all' | 'screening' | 'shortlisted' | 'interviewing' | 'offer' | 'hired' | 'rejected'
  const [verdictFilter, setVerdictFilter] = useState('all'); // 'all' | 'Shortlisted' | 'Borderline' | 'Not a fit'
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  
  // Slide-out Drawer active candidate profile and tabs
  const [activeDrawerCandidateId, setActiveDrawerCandidateId] = useState(null);
  const [drawerActiveTab, setDrawerActiveTab] = useState('overview'); // 'overview' | 'resume' | 'scorecard' | 'timeline'
  const [interviewerName, setInterviewerName] = useState('Lead Frontend Architect');
  const [interviewDateTime, setInterviewDateTime] = useState('');
  const [interviewAgenda, setInterviewAgenda] = useState('Technical Screening & Coding Evaluation');
  
  // RecruiterPro Collaborative Ratings and Careers Page preview states
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

  // Additional RecruiterPro Extension States
  const [activeSkillFilters, setActiveSkillFilters] = useState([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState('Recruiter Note');
  const [isCustomizingTemplate, setIsCustomizingTemplate] = useState(false);
  const [tempSubject, setTempSubject] = useState('');
  const [tempBody, setTempBody] = useState('');
  const [careersTheme, setCareersTheme] = useState('indigo');
  const [careersFont, setCareersFont] = useState('sans');
  const [activeSidebarTab, setActiveSidebarTab] = useState('candidates');

  // LinkedIn Portal States
  const [linkedinActiveTab, setLinkedinActiveTab] = useState('post'); // 'post' | 'search' | 'settings'
  const [linkedInConnected, setLinkedInConnected] = useState(() => {
    return localStorage.getItem('rp_linkedin_connected') === 'true';
  });
  const [linkedInMode, setLinkedInMode] = useState(() => {
    return localStorage.getItem('rp_linkedin_mode') || 'sandbox'; // 'sandbox' | 'live'
  });
  const [linkedInClientId, setLinkedInClientId] = useState(() => {
    return localStorage.getItem('rp_linkedin_client_id') || '';
  });
  const [linkedInClientSecret, setLinkedInClientSecret] = useState(() => {
    return localStorage.getItem('rp_linkedin_client_secret') || '';
  });
  const [linkedInRedirectUri, setLinkedInRedirectUri] = useState(() => {
    return localStorage.getItem('rp_linkedin_redirect_uri') || window.location.origin + '/';
  });
  const [linkedInProfile, setLinkedInProfile] = useState(() => {
    const saved = localStorage.getItem('rp_linkedin_profile');
    return saved ? JSON.parse(saved) : null;
  });

  // LinkedIn Posting states
  const [selectedJobForLinkedIn, setSelectedJobForLinkedIn] = useState('job-1');
  const [linkedInPostType, setLinkedInPostType] = useState('member'); // 'member' | 'company'
  const [linkedInCompanyId, setLinkedInCompanyId] = useState(() => {
    return localStorage.getItem('rp_linkedin_company_id') || '';
  });
  const [linkedInShareText, setLinkedInShareText] = useState('');
  const [isPostingToLinkedIn, setIsPostingToLinkedIn] = useState(false);
  const [linkedInPostSuccess, setLinkedInPostSuccess] = useState(false);
  const [linkedInShareUrl, setLinkedInShareUrl] = useState('');
  
  // LinkedIn Posting History
  const [linkedInPostHistory, setLinkedInPostHistory] = useState(() => {
    const saved = localStorage.getItem('rp_linkedin_post_history');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'li-post-1',
        jobId: 'job-1',
        jobTitle: 'Senior Frontend Engineer (React)',
        postType: 'member',
        shareText: "We're hiring: Senior Frontend Engineer (React)! 🚀\n\nMust-haves:\n• React\n• TypeScript\n• 5+ years experience\n• Tailwind CSS\n• Git\n\nJoin our fast-growing engineering team. Apply directly or DM for details! #hiring #jobs #career #seniorfrontendengineerreact",
        postedAt: '2026-06-20 11:30 AM',
        status: 'Live',
        views: 245,
        clicks: 34,
        applies: 8,
        shareUrl: 'https://www.linkedin.com/feed/update/urn:li:share:7123984712039841'
      },
      {
        id: 'li-post-2',
        jobId: 'job-2',
        jobTitle: 'Senior Data Scientist (Python / AI)',
        postType: 'company',
        shareText: "We're hiring: Senior Data Scientist (Python / AI)! 🚀\n\nMust-haves:\n• Python\n• PyTorch\n• 3+ years AI/ML experience\n• SQL\n• LLMs\n\nJoin our fast-growing engineering team. Apply directly or DM for details! #hiring #jobs #career #seniordatascientistpythonai",
        postedAt: '2026-06-18 09:15 AM',
        status: 'Live',
        views: 412,
        clicks: 89,
        applies: 14,
        shareUrl: 'https://www.linkedin.com/feed/update/urn:li:share:7123984712039842'
      }
    ];
  });

  // LinkedIn Search States
  const [linkedInSearchQuery, setLinkedInSearchQuery] = useState('React Developer');
  const [linkedInSearchLocation, setLinkedInSearchLocation] = useState('Remote');
  const [linkedInSearchJobType, setLinkedInSearchJobType] = useState('all'); // 'all' | 'full-time' | 'part-time' | 'contract' | 'internship'
  const [linkedInSearchExperience, setLinkedInSearchExperience] = useState('all'); // 'all' | 'entry' | 'mid-senior' | 'director'
  const [isSearchingLinkedIn, setIsSearchingLinkedIn] = useState(false);
  const [linkedInSearchHasSearched, setLinkedInSearchHasSearched] = useState(false);
  const [linkedInSearchResults, setLinkedInSearchResults] = useState([]);
  const [selectedSearchResult, setSelectedSearchResult] = useState(null);

  // Simulated OAuth screen state
  const [isLinkedInAuthOpen, setIsLinkedInAuthOpen] = useState(false);
  const [authStep, setAuthStep] = useState('login'); // 'login' | 'consent' | 'processing'
  const [authEmail, setAuthEmail] = useState('admink338@gmail.com');
  const [authPassword, setAuthPassword] = useState('••••••••');

  const [linkedInAccessToken, setLinkedInAccessToken] = useState(() => {
    return localStorage.getItem('rp_linkedin_access_token') || '';
  });

  // PKCE Helper utilities for secure client-side LinkedIn OAuth
  const generateRandomString = (length) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let text = '';
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };

  const sha256 = async (plain) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
  };

  const base64urlencode = (a) => {
    let str = "";
    const bytes = new Uint8Array(a);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const generateCodeChallenge = async (verifier) => {
    const hashed = await sha256(verifier);
    return base64urlencode(hashed);
  };

  const getLinkedInApiUrl = (path) => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      return `/linkedin-api/${path}`;
    } else {
      return `/api/linkedin-proxy?path=${encodeURIComponent(path)}`;
    }
  };

  const fetchLinkedInProfileDetails = async (token) => {
    // Try OpenID Connect /v2/userinfo first, as it is standard for modern apps
    try {
      const res = await fetch(getLinkedInApiUrl('v2/userinfo'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        console.log("LinkedIn userinfo response:", data);
        localStorage.setItem('rp_debug_userinfo', JSON.stringify(data));
        localStorage.removeItem('rp_debug_userinfo_err');
        
        const id = data.sub || data.id;
        const name = data.name || `${data.given_name || ''} ${data.family_name || ''}`.trim() || 'Recruiter';
        return { id, name };
      } else {
        const errText = await res.text();
        console.error("LinkedIn userinfo error:", res.status, errText);
        localStorage.setItem('rp_debug_userinfo_err', `Status ${res.status}: ${errText}`);
      }
    } catch (e) {
      console.warn("Fetch /v2/userinfo details failed, trying /v2/me", e);
      localStorage.setItem('rp_debug_userinfo_exc', e.message);
    }

    // Fallback to /v2/me
    try {
      const res = await fetch(getLinkedInApiUrl('v2/me'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("LinkedIn /v2/me error:", res.status, errText);
        localStorage.setItem('rp_debug_me_err', `Status ${res.status}: ${errText}`);
        throw new Error(`[HTTP ${res.status}] ${res.statusText || 'Error'}: ${errText}`);
      }
      const data = await res.json();
      console.log("LinkedIn /v2/me response:", data);
      localStorage.setItem('rp_debug_me', JSON.stringify(data));
      localStorage.removeItem('rp_debug_me_err');
      
      const id = data.id;
      const firstName = data.localizedFirstName || (data.firstName && data.firstName.localized && Object.values(data.firstName.localized)[0]) || '';
      const lastName = data.localizedLastName || (data.lastName && data.lastName.localized && Object.values(data.lastName.localized)[0]) || '';
      const name = `${firstName} ${lastName}`.trim() || 'Recruiter';
      return { id, name };
    } catch (e) {
      localStorage.setItem('rp_debug_me_exc', e.message);
      if (e.message.includes('Failed to fetch')) {
        throw new Error("Network error (Failed to fetch) while fetching profile. Please check your connection.");
      }
      throw e;
    }
  };

  const exchangeLinkedInCodeForToken = async (code) => {
    setIsPostingToLinkedIn(true);
    try {
      const clientId = (localStorage.getItem('rp_linkedin_client_id') || linkedInClientId || '').trim();
      const clientSecret = (localStorage.getItem('rp_linkedin_client_secret') || linkedInClientSecret || '').trim();
      const redirectUri = (localStorage.getItem('rp_linkedin_redirect_uri') || linkedInRedirectUri || '').trim();
      const codeVerifier = localStorage.getItem('rp_linkedin_code_verifier');

      if (!clientId || !clientSecret) {
        throw new Error("Client ID and Client Secret must be configured in settings to complete authorization.");
      }

      // Exchange authorization code for access token via CORS proxy
      const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
      const bodyParams = {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret
      };

      // Add code_verifier if it was generated during authorization redirect
      if (codeVerifier) {
        bodyParams.code_verifier = codeVerifier.trim();
      }

      // Call our own Vercel serverless function to exchange the code server-side.
      // This avoids CORS issues since LinkedIn's token endpoint blocks browser requests.
      const apiBase = window.location.origin;
      console.log('Calling /api/linkedin-token at:', apiBase);

      const response = await fetch(apiBase + '/api/linkedin-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
          ...(codeVerifier ? { code_verifier: codeVerifier } : {})
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error_description || errData.error || ('HTTP ' + response.status);
        localStorage.setItem('rp_debug_token_err', JSON.stringify(errData));
        throw new Error('Token exchange failed: ' + errMsg);
      }
      const data = await response.json();
      const accessToken = data.access_token;
      if (!accessToken) {
        throw new Error("No access_token returned in the response");
      }

      setLinkedInAccessToken(accessToken);
      localStorage.setItem('rp_linkedin_access_token', accessToken);

      // Fetch user profile details
      const profileData = await fetchLinkedInProfileDetails(accessToken);
      setLinkedInConnected(true);
      setLinkedInProfile({
        name: profileData.name,
        headline: 'Talent Acquisition Partner (Live API)',
        avatar: profileData.name.split(' ').map(n => n[0]).join(''),
        id: profileData.id
      });

      localStorage.removeItem('rp_linkedin_code_verifier');

      // Clear code query param from browser address bar
      const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);

      setActiveSidebarTab('linkedin');
      setLinkedinActiveTab('settings');
      alert('Successfully authenticated and connected your live LinkedIn account!');
    } catch (err) {
      console.error("LinkedIn OAuth Exchange Error:", err);
      alert('LinkedIn Connection Failed: ' + err.message + '\n\nTroubleshooting:\n 1. Ensure your LinkedIn app has the Share on LinkedIn or Sign In with LinkedIn product enabled.\n 2. Verify Client ID and Secret are exactly correct in Settings.\n 3. Make sure redirect URI (' + window.location.origin + '/) is in LinkedIn Developer Portal Authorized Redirect URLs.\n 4. Re-click Authorize Account to get a fresh authorization code.');
    } finally {
      setIsPostingToLinkedIn(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('rp_linkedin_access_token', linkedInAccessToken);
  }, [linkedInAccessToken]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const mode = localStorage.getItem('rp_linkedin_mode') || linkedInMode;
    if (code && mode === 'live') {
      exchangeLinkedInCodeForToken(code);
    }
  }, []);

  // Save credentials and settings changes
  useEffect(() => {
    localStorage.setItem('rp_linkedin_connected', linkedInConnected ? 'true' : 'false');
  }, [linkedInConnected]);

  useEffect(() => {
    localStorage.setItem('rp_linkedin_mode', linkedInMode);
  }, [linkedInMode]);

  useEffect(() => {
    localStorage.setItem('rp_linkedin_client_id', linkedInClientId);
  }, [linkedInClientId]);

  useEffect(() => {
    localStorage.setItem('rp_linkedin_client_secret', linkedInClientSecret);
  }, [linkedInClientSecret]);

  useEffect(() => {
    localStorage.setItem('rp_linkedin_redirect_uri', linkedInRedirectUri);
  }, [linkedInRedirectUri]);

  useEffect(() => {
    if (linkedInProfile) {
      localStorage.setItem('rp_linkedin_profile', JSON.stringify(linkedInProfile));
    } else {
      localStorage.removeItem('rp_linkedin_profile');
    }
  }, [linkedInProfile]);

  useEffect(() => {
    localStorage.setItem('rp_linkedin_company_id', linkedInCompanyId);
  }, [linkedInCompanyId]);

  // Update LinkedIn Share Text when selected job changes
  useEffect(() => {
    const job = jobs.find(j => j.id === selectedJobForLinkedIn);
    if (job) {
      setLinkedInShareText(`We're hiring: ${job.title}! 🚀\n\nMust-haves:\n${job.mustHaves ? job.mustHaves.split(',').map(s => `• ${s.trim()}`).join('\n') : ''}\n\nJoin our fast-growing engineering team. Apply directly or DM for details! #hiring #jobs #career #${job.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
    } else {
      setLinkedInShareText('');
    }
  }, [selectedJobForLinkedIn, jobs]);

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
  const [isCandidateAuthOpen, setIsCandidateAuthOpen] = useState(false);
  const [candidateAuthMode, setCandidateAuthMode] = useState('login'); // 'login' | 'register'
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePassword, setCandidatePassword] = useState('');
  const [candidateAuthError, setCandidateAuthError] = useState(null);
  const [candidateAuthLoading, setCandidateAuthLoading] = useState(false);
  const [selectedJobForApplication, setSelectedJobForApplication] = useState(null);
  const [candidateAppliedText, setCandidateAppliedText] = useState('');
  const [offerSalaryLpa, setOfferSalaryLpa] = useState('15');
  const [offerJoiningDate, setOfferJoiningDate] = useState('');
  const [offerNotes, setOfferNotes] = useState('');
  const [activeOfferCandidateId, setActiveOfferCandidateId] = useState(null);
  const [isGeneratingOffer, setIsGeneratingOffer] = useState(false);
  const [candidateSignature, setCandidateSignature] = useState('');
  const [isOfferSigned, setIsOfferSigned] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantMessages, setAssistantMessages] = useState([
    {
      sender: 'assistant',
      text: "Hi! I'm your RecruitPro AI Assistant. Ask me to find the best candidate, filter by specific skills, list immediate joiners, or summarize a resume!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [expandedResumeIds, setExpandedResumeIds] = useState([]);
  // Candidate Portal Navigation
  const [activeCandidateNavTab, setActiveCandidateNavTab] = useState('dashboard');
  const [savedJobIds, setSavedJobIds] = useState([]);
  const [candidateAIMessages, setCandidateAIMessages] = useState([
    { sender: 'ai', text: "Hi! I'm your AI Career Assistant. I can help you with interview prep, resume tips, career guidance, and job recommendations. What would you like help with today?" }
  ]);
  const [candidateAIInput, setCandidateAIInput] = useState('');
  const [candidateProfileData, setCandidateProfileData] = useState({
    fullName: '', phone: '', location: '', headline: '', skills: '', education: '', experience: '', bio: '', avatarUrl: '', github: '', linkedin: '', portfolio: ''
  });

  useEffect(() => {
    if (session && session.user && userRole !== 'admin') {
      const meta = session.user.user_metadata || {};
      if (meta.candidateProfileData) {
        setCandidateProfileData(meta.candidateProfileData);
      } else {
        // Initialize clean state for a new candidate
        setCandidateProfileData({
          fullName: (session?.user?.email || 'Candidate').split('@')[0],
          phone: '',
          location: '',
          headline: '',
          skills: '',
          education: '',
          experience: '',
          bio: '',
          avatarUrl: '',
          github: '',
          linkedin: '',
          portfolio: ''
        });
      }
      
      if (meta.savedJobIds) {
        setSavedJobIds(meta.savedJobIds);
      } else {
        setSavedJobIds([]);
      }
      
      if (meta.candidateAIMessages) {
        setCandidateAIMessages(meta.candidateAIMessages);
      } else {
        setCandidateAIMessages([
          { sender: 'ai', text: "Hi! I'm your AI Career Assistant. I can help you with interview prep, resume tips, career guidance, and job recommendations. What would you like help with today?" }
        ]);
      }
    } else {
      // Clear out states entirely on logout/sign-out or admin login
      setCandidateProfileData({
        fullName: '', phone: '', location: '', headline: '', skills: '', education: '', experience: '', bio: '', avatarUrl: '', github: '', linkedin: '', portfolio: ''
      });
      setSavedJobIds([]);
      setCandidateAIMessages([
        { sender: 'ai', text: "Hi! I'm your AI Career Assistant. I can help you with interview prep, resume tips, career guidance, and job recommendations. What would you like help with today?" }
      ]);
    }
  }, [session, userRole]);

  const [candidateDocuments, setCandidateDocuments] = useState([
    { id: 1, name: 'Resume_2026_Final.pdf', type: 'Resume', size: '245 KB', date: '2026-06-15', icon: '📄' },
    { id: 2, name: 'Cover_Letter_TechCorp.docx', type: 'Cover Letter', size: '82 KB', date: '2026-06-14', icon: '📝' },
    { id: 3, name: 'Portfolio_Samples.zip', type: 'Portfolio', size: '4.2 MB', date: '2026-06-10', icon: '🗂' },
    { id: 4, name: 'Certifications_AWS.pdf', type: 'Certificate', size: '560 KB', date: '2026-05-28', icon: '🏆' },
  ]);
  const [candidateAssessments, setCandidateAssessments] = useState([
    { id: 1, title: 'JavaScript Proficiency Test', company: 'TechCorp Solutions', duration: '45 min', questions: 3, dueDate: '2026-06-25', status: 'pending', difficulty: 'Intermediate' },
    { id: 2, title: 'System Design Assessment', company: 'Innovate Labs', duration: '90 min', questions: 3, dueDate: '2026-06-28', status: 'pending', difficulty: 'Advanced' },
    { id: 3, title: 'React & TypeScript Quiz', company: 'StartupXYZ', duration: '30 min', questions: 3, dueDate: '2026-06-20', status: 'completed', score: 87, difficulty: 'Intermediate' },
  ]);
  const [candidateMessages, setCandidateMessages] = useState([
    { id: 1, from: 'Sarah Johnson', role: 'HR Manager @ TechCorp', avatar: 'SJ', time: '10:30 AM', preview: 'Congrats! You have been shortlisted for the next round...', unread: true, color: '#6366f1', chatHistory: [
      { sender: 'them', text: 'Hello! Thanks for applying to TechCorp. We reviewed your profile and love your React experience.' },
      { sender: 'user', text: 'Thank you! I am very excited about the opportunity.' },
      { sender: 'them', text: 'Congrats! You have been shortlisted for the next round. I will schedule the interview shortly.' }
    ]},
    { id: 2, from: 'Michael Chen', role: 'Tech Lead @ Innovate Labs', avatar: 'MC', time: 'Yesterday', preview: 'We reviewed your application and would like to schedule...', unread: true, color: '#8b5cf6', chatHistory: [
      { sender: 'them', text: 'Hi! Can you discuss your experience with micro-frontends?' },
      { sender: 'user', text: 'Yes, I have worked with Module Federation in webpack to build micro-frontends.' },
      { sender: 'them', text: 'We reviewed your application and would like to schedule a technical round.' }
    ]},
    { id: 3, from: 'Priya Sharma', role: 'Recruiter @ StartupXYZ', avatar: 'PS', time: '2 days ago', preview: 'Thank you for applying. Our team has been impressed by...', unread: false, color: '#ec4899', chatHistory: [
      { sender: 'them', text: 'Thank you for applying. Our team has been impressed by your resume.' }
    ]},
    { id: 4, from: 'RecruiterPro Team', role: 'Platform Notification', avatar: 'RP', time: '3 days ago', preview: 'Your profile has been viewed 12 times this week!', unread: false, color: '#f59e0b', chatHistory: [
      { sender: 'them', text: 'Your profile has been viewed 12 times this week!' }
    ]},
  ]);
  const [candidateNotifications, setCandidateNotifications] = useState([
    { id: 1, icon: '🎯', title: 'Application Viewed', body: 'TechCorp Solutions viewed your profile for Senior React Developer', time: '2 hours ago', unread: true },
    { id: 2, icon: '📅', title: 'Interview Reminder', body: 'Your interview with Innovate Labs is scheduled for tomorrow at 11:00 AM', time: '5 hours ago', unread: true },
    { id: 3, icon: '⭐', title: 'New Recommendation', body: '3 new jobs match your profile — Senior Frontend Engineer at Google, Meta, and Netflix', time: '1 day ago', unread: false },
    { id: 4, icon: '✅', title: 'Assessment Completed', body: 'Your React & TypeScript quiz results: 87/100. Great job!', time: '2 days ago', unread: false },
    { id: 5, icon: '💼', title: 'Application Status Update', body: 'StartupXYZ moved your application to the Interview stage', time: '3 days ago', unread: false },
  ]);
  const [settingsPreferences, setSettingsPreferences] = useState({
    emailNotifications: true,
    statusUpdates: true,
    reminders: true,
    recommendations: false,
    visibility: 'Public'
  });
  
  const [activeAssessmentQuiz, setActiveAssessmentQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [activePracticeTopic, setActivePracticeTopic] = useState(null);
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [practiceFeedback, setPracticeFeedback] = useState(null);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [activeChatMsg, setActiveChatMsg] = useState(null);
  const [newMessageText, setNewMessageText] = useState('');

  const handleCandidateFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const sizeStr = file.size > 1024 * 1024 
      ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
      : (file.size / 1024).toFixed(0) + ' KB';
    const newDoc = {
      id: Date.now(),
      name: file.name,
      type: file.name.endsWith('.docx') ? 'Cover Letter' : 'Resume',
      size: sizeStr,
      date: new Date().toLocaleDateString(),
      icon: file.name.endsWith('.docx') ? '📝' : '📄'
    };
    setCandidateDocuments(prev => [newDoc, ...prev]);
    alert(`🎉 Successfully uploaded ${file.name}!`);
  };

  const handleCandidatePasteUpload = () => {
    if (!pasteText.trim()) return;
    const name = pasteName.trim() || 'Pasted_Resume.txt';
    const newDoc = {
      id: Date.now(),
      name: name.endsWith('.txt') ? name : name + '.txt',
      type: 'Resume',
      size: `${(pasteText.length / 1024).toFixed(1)} KB`,
      date: new Date().toLocaleDateString(),
      icon: '📄'
    };
    setCandidateDocuments(prev => [newDoc, ...prev]);
    setPasteFallbackOpen(false);
    setPasteName('');
    setPasteText('');
    alert(`🎉 Document "${newDoc.name}" added to Resume Center!`);
  };

  const handleQuickApply = (job) => {
    const candidateId = 'portal-' + Math.random().toString(36).substring(7);
    const resumeText = `${session.user.email.split('@')[0]}\nEmail: ${session.user.email}\n\nExperience: 5+ years React Developer. Skills: React, TypeScript, Redux, Tailwind CSS.`;
    const tempCand = {
      id: candidateId, name: session.user.email.split('@')[0], text: resumeText,
      noticePeriod: null, currentCtc: null, expectedCtc: null, location: null,
      preferredLocation: null, resumeQuality: null, scorecard: null, activityLog: null
    };
    const evalData = analyzeCandidateOffline(tempCand, job.title, job.description || 'Google is hiring.', job.tags?.join(', ') || 'React');
    const timeStr = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const mockRatings = {
      recruiter: evalData.scorecard,
      technical: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "Awaiting technical review." },
      hr: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "Awaiting HR review." }
    };
    
    const newCandidate = {
      id: candidateId, name: session.user.email.split('@')[0],
      fileName: `${job.title.replace(/\s+/g, '_')}_Resume.txt`,
      fileSize: resumeText.length, status: 'completed', ocrProgress: 0, text: resumeText,
      numChars: resumeText.length, errorDetails: '', score: evalData.calculatedScore,
      evaluation: evalData, stage: 'screening', noticePeriod: evalData.notice_period,
      currentCtc: evalData.current_ctc, expectedCtc: evalData.expected_ctc,
      location: evalData.location, preferredLocation: evalData.preferred_location,
      resumeQuality: evalData.resume_quality, scorecard: evalData.scorecard,
      activityLog: [
        { id: 1, type: "applied", text: `Candidate applied via Quick Apply for job: ${job.title}`, timestamp: timeStr },
        { id: 2, type: "screened", text: `ATS Match Screen complete. ATS Score: ${evalData.calculatedScore}%`, timestamp: timeStr }
      ],
      jobsData: {
        [job.id]: {
          score: evalData.calculatedScore, evaluation: evalData, stage: 'screening',
          scorecard: evalData.scorecard, collaboratorRatings: mockRatings,
          activityLog: [
            { id: 1, type: "applied", text: `Candidate applied via Quick Apply for job: ${job.title}`, timestamp: timeStr },
            { id: 2, type: "screened", text: `ATS Match Screen complete. ATS Score: ${evalData.calculatedScore}%`, timestamp: timeStr }
          ]
        }
      }
    };
    
    setCandidates(prev => [...prev, newCandidate]);
    alert(`🎉 Applied to ${job.title} at ${job.company} successfully! ATS Match: ${evalData.calculatedScore}%`);
  };

  const handleMarkNotificationRead = (id) => {
    setCandidateNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
  };

  const saveCandidateMetadata = async (profile, savedJobs, chatMessages) => {
    if (!session || !session.user) return;
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          candidateProfileData: profile || candidateProfileData,
          savedJobIds: savedJobs || savedJobIds,
          candidateAIMessages: chatMessages || candidateAIMessages
        }
      });
      if (error) throw error;
      if (data && data.user) {
        setSession(prev => {
          if (!prev) return prev;
          return { ...prev, user: data.user };
        });
      }
    } catch (err) {
      console.error("Failed to save candidate metadata:", err.message);
    }
  };

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
      const sanitizedCandidates = candidates.map(sanitizeCandidate);
      const { error: candErr } = await supabase.from('candidates').upsert(sanitizedCandidates);
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

      // Load candidates from DB and merge with any stable local-only candidates
      if (dbCandidates && dbCandidates.length > 0) {
        // Find any local stable candidates that are not yet in the DB (e.g. just uploaded)
        const dbIds = new Set(dbCandidates.map(c => c.id));
        const stableStatuses = ['ready', 'completed', 'failed'];
        const localOnly = candidates
          .filter(c => !dbIds.has(c.id) && stableStatuses.includes(c.status))
          .map(sanitizeCandidate);

        // Immediately persist any local-only stable candidates to DB
        if (localOnly.length > 0) {
          await supabase.from('candidates').upsert(localOnly);
        }

        // Merge: DB records + any local-only ones not yet in DB
        const merged = [
          ...dbCandidates,
          ...candidates.filter(c => !dbIds.has(c.id))
        ];
        prevCandidatesRef.current = merged;
        setCandidates(merged);
      } else {
        const sanitizedCandidates = candidates.map(sanitizeCandidate);
        const { error: err } = await supabase.from('candidates').upsert(sanitizedCandidates);
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
        
        // Map to sanitized objects for safe comparison and upsert
        const sanitizedCandidates = candidates.map(sanitizeCandidate);
        const prevSanitized = prev.map(sanitizeCandidate);

        // NOTE: We do NOT delete from the DB when candidates are removed from local state.
        // The DB is a permanent, append-only record of all candidates ever added.
        // Removing from the local React view (e.g. "Clear All") should never wipe DB records.

        // Only upsert candidates in stable states (avoid race conditions from transient reading/screening states)
        const stableSanitizedCandidates = sanitizedCandidates.filter(
          c => c.status !== 'reading' && c.status !== 'ocr_progress' && c.status !== 'screening'
        );

        const changed = stableSanitizedCandidates.filter(c => {
          const p = prevSanitized.find(prevC => prevC.id === c.id);
          if (!p) return true;
          return JSON.stringify(p) !== JSON.stringify(c);
        });

        if (changed.length > 0) {
          const { error: upsertErr } = await supabase.from('candidates').upsert(changed);
          if (upsertErr) throw upsertErr;
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

                {/* ─── JD Requirements Gate ─── */}
                {(evalData.must_have_results?.length > 0 || evalData.gate_status) && (
                  <div className="card" style={{ padding: 0, overflow: 'hidden', border: `2px solid ${
                    evalData.gate_status === 'pass' ? 'var(--color-sage)' :
                    evalData.gate_status === 'partial' ? 'var(--color-gold)' :
                    'var(--color-terracotta)'
                  }` }}>
                    {/* Gate Header Banner */}
                    <div style={{
                      padding: '0.65rem 1rem',
                      background: evalData.gate_status === 'pass'
                        ? 'linear-gradient(90deg, var(--color-sage-light, #edf7ee), transparent)'
                        : evalData.gate_status === 'partial'
                          ? 'linear-gradient(90deg, var(--color-gold-light, #fef9ec), transparent)'
                          : 'linear-gradient(90deg, rgba(200,80,60,0.08), transparent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderBottom: '1px solid var(--color-border)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {evalData.gate_status === 'pass'
                          ? <span style={{ fontSize: '1rem' }}>✅</span>
                          : evalData.gate_status === 'partial'
                            ? <span style={{ fontSize: '1rem' }}>⚠️</span>
                            : <span style={{ fontSize: '1rem' }}>🚫</span>
                        }
                        <span style={{ fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em',
                          color: evalData.gate_status === 'pass' ? 'var(--color-sage)' : evalData.gate_status === 'partial' ? 'var(--color-gold)' : 'var(--color-terracotta)'
                        }}>
                          JD Requirements Gate — {
                            evalData.gate_status === 'hard_fail' ? 'Hard Fail (Score Capped)' :
                            evalData.gate_status === 'soft_fail' ? 'Soft Fail (Score Capped)' :
                            evalData.gate_status === 'partial'   ? 'Partial Pass (Minor Gaps)' :
                            'All Requirements Met'
                          }
                        </span>
                      </div>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: '700', fontFamily: 'var(--font-mono)',
                        padding: '0.2rem 0.5rem', borderRadius: '20px',
                        background: evalData.gate_status === 'pass' ? 'var(--color-sage)' : evalData.gate_status === 'partial' ? 'var(--color-gold)' : 'var(--color-terracotta)',
                        color: '#fff'
                      }}>
                        {evalData.must_have_met ?? 0}/{evalData.must_have_total ?? 0} Must-Haves
                      </span>
                    </div>

                    {/* Gate Reason */}
                    {evalData.gate_reason && (
                      <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: 'var(--color-ink-muted)', borderBottom: '1px solid var(--color-border)', fontStyle: 'italic' }}>
                        {evalData.gate_reason}
                      </div>
                    )}

                    {/* Must-Have Checklist */}
                    {evalData.must_have_results?.length > 0 && (
                      <div style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '700', color: 'var(--color-ink-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                          Must-Have Requirements Check
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {evalData.must_have_results.map((req, idx) => (
                            <div key={idx} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '0.35rem 0.5rem', borderRadius: '6px',
                              background: req.met ? 'rgba(72,172,94,0.07)' : 'rgba(200,80,60,0.07)',
                              border: `1px solid ${req.met ? 'rgba(72,172,94,0.2)' : 'rgba(200,80,60,0.2)'}`,
                              gap: '0.5rem'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{req.met ? '✅' : '❌'}</span>
                                <span style={{ fontSize: '0.78rem', fontWeight: '600', color: req.met ? 'var(--color-sage)' : 'var(--color-terracotta)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {req.label}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.68rem', color: 'var(--color-ink-muted)', flexShrink: 0, fontStyle: 'italic' }}>
                                {req.reason}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Experience Comparison Bar */}
                    {(evalData.candidate_years !== undefined && evalData.required_years !== undefined) && (
                      <div style={{ padding: '0.5rem 1rem 0.75rem', borderTop: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-ink-muted)', textTransform: 'uppercase' }}>
                            Experience vs Requirement
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: '700', fontFamily: 'var(--font-mono)',
                            color: evalData.candidate_years >= evalData.required_years ? 'var(--color-sage)' : 'var(--color-terracotta)' }}>
                            {evalData.candidate_years} yrs / {evalData.required_years}+ required
                            {evalData.candidate_years >= evalData.required_years ? ' ✓' : ` (${evalData.required_years - evalData.candidate_years} yr gap)`}
                          </span>
                        </div>
                        <div style={{ background: 'var(--color-border)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: '4px',
                            width: `${Math.min(100, (evalData.candidate_years / Math.max(evalData.required_years, 1)) * 100)}%`,
                            background: evalData.candidate_years >= evalData.required_years ? 'var(--color-sage)' : 'var(--color-terracotta)',
                            transition: 'width 0.8s ease-in-out'
                          }} />
                        </div>
                      </div>
                    )}

                    {/* Fate Decision Footer */}
                    <div style={{
                      padding: '0.6rem 1rem',
                      background: evalData.gate_status === 'pass'
                        ? 'rgba(72,172,94,0.1)'
                        : evalData.gate_status === 'partial'
                          ? 'rgba(192,154,85,0.1)'
                          : 'rgba(200,80,60,0.1)',
                      borderTop: '1px solid var(--color-border)',
                      display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-ink-muted)' }}>Fate Decision:</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: '700',
                        color: evalData.gate_status === 'pass' ? 'var(--color-sage)' : evalData.gate_status === 'partial' ? 'var(--color-gold)' : 'var(--color-terracotta)'
                      }}>
                        {evalData.gate_status === 'hard_fail' ? '🚫 Decline Recommended — Critical requirements not met'
                          : evalData.gate_status === 'soft_fail' ? '⚠️ Phone Screen Recommended — Multiple gaps to clarify'
                          : evalData.gate_status === 'partial'   ? '📋 Conditional Shortlist — Minor gaps, verify in interview'
                          : '✅ Proceed to Interview — Meets all requirements'
                        }
                      </span>
                    </div>
                  </div>
                )}

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

                {renderRadarChart(evalData.subscores)}

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

                  {/* Recruiter Offer Generator (Only displayed if stage is 'offer' or 'offer_extended') */}
                  {(candidate.stage === 'offer' || candidate.stage === 'offer_extended') && (
                    <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--color-terracotta)', backgroundColor: 'var(--color-paper-light)', marginTop: '1rem' }}>
                      <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--color-terracotta)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.25rem', margin: 0 }}>
                        ✍️ Recruiter Offer Generator
                      </h4>
                      <p className="text-xs text-muted" style={{ margin: 0 }}>This candidate has reached the Offer stage. Specify salary and joining terms to generate and extend the formal offer letter.</p>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label text-xs">Salary Package (LPA)</label>
                          <input 
                            type="number" 
                            className="input-text text-sm" 
                            value={offerSalaryLpa}
                            onChange={(e) => setOfferSalaryLpa(e.target.value)}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label text-xs">Target Joining Date</label>
                          <input 
                            type="date" 
                            className="input-text text-sm" 
                            value={offerJoiningDate}
                            onChange={(e) => setOfferJoiningDate(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label text-xs">Offer Clauses / Benefits Notes</label>
                        <textarea 
                          className="input-textarea text-sm" 
                          style={{ minHeight: '80px' }}
                          placeholder="e.g. Standard health coverage, 20 days paid leave, remote eligible, signing bonus..."
                          value={offerNotes}
                          onChange={(e) => setOfferNotes(e.target.value)}
                        />
                      </div>

                      <button
                        type="button"
                        className="btn-primary"
                        style={{ alignSelf: 'flex-start', width: 'auto', padding: '0.5rem 1.25rem', fontSize: '0.82rem', backgroundColor: 'var(--color-terracotta)', cursor: 'pointer' }}
                        onClick={() => {
                          if (!offerJoiningDate) {
                            alert("Please select a target joining date.");
                            return;
                          }
                          const timeStr = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          const updatedLog = [...(candidate.activityLog || [])];
                          updatedLog.push({
                            id: updatedLog.length + 1,
                            type: 'offer_extended',
                            text: `📝 Job Offer Extended: Salary: ${offerSalaryLpa} LPA, Join Date: ${offerJoiningDate}`,
                            timestamp: timeStr
                          });
                          updateCandidateJobData(candidate.id, {
                            stage: 'offer_extended',
                            offerDetails: {
                              salaryLpa: offerSalaryLpa,
                              joiningDate: offerJoiningDate,
                              notes: offerNotes,
                              extendedAt: timeStr
                            },
                            evaluation: candidate.evaluation ? {
                              ...candidate.evaluation,
                              activity_log: updatedLog
                            } : null,
                            activityLog: updatedLog
                          });
                          alert("🎉 Formal job offer extended to candidate successfully!");
                        }}
                      >
                        {candidate.stage === 'offer_extended' ? 'Update & Re-extend Offer' : 'Generate & Extend Offer'}
                      </button>
                    </div>
                  )}
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
    if (careersFont === 'serif') fontStyle = 'var(--font-display)';
    else if (careersFont === 'mono') fontStyle = 'var(--font-mono)';

    return (
      <div className="modal-backdrop">
        <div className="modal-content careers-preview-modal" style={{ width: '980px', maxWidth: '95vw', height: '650px', maxHeight: '90vh', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="careers-header" style={{ background: 'linear-gradient(135deg, #1E293B, #0F172A)', color: '#F8FAFC', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="text-xs" style={{ textTransform: 'uppercase', color: primaryColor, fontWeight: 'bold' }}>Live Careers Page Preview</span>
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
            {/* Customizer Sidebar */}
            <div className="careers-customizer-sidebar" style={{ width: '250px', borderRight: '1px solid var(--color-border)', backgroundColor: 'var(--color-paper-darker)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
              <span style={{ fontWeight: '800', fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>Site Styles Customizer</span>
              
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
                        display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem',
                        border: '1px solid ' + (careersTheme === thm.id ? thm.color : 'var(--color-border)'),
                        borderRadius: '6px', background: careersTheme === thm.id ? 'var(--color-white)' : 'none',
                        color: 'var(--color-ink)', cursor: 'pointer', fontWeight: careersTheme === thm.id ? 'bold' : 'normal', fontSize: '0.8rem', textAlign: 'left'
                      }}
                    >
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: thm.color, display: 'inline-block' }} />
                      {thm.name}
                    </button>
                  ))}
                </div>
              </div>

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
                        padding: '0.5rem 0.75rem', border: '1px solid ' + (careersFont === fnt.id ? 'var(--color-terracotta)' : 'var(--color-border)'),
                        borderRadius: '6px', background: careersFont === fnt.id ? 'var(--color-white)' : 'none',
                        color: 'var(--color-ink)', cursor: 'pointer', fontWeight: careersFont === fnt.id ? 'bold' : 'normal', fontSize: '0.8rem', fontFamily: fnt.family, textAlign: 'left'
                      }}
                    >
                      {fnt.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Careers board listings */}
            <div className="scroll-container" style={{ flex: 1, padding: '2rem', overflowY: 'auto', backgroundColor: '#FFFFFF', fontFamily: fontStyle, color: '#1E293B' }}>
              <div style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', color: '#0F172A', margin: 0 }}>Acme Corp Active Openings</h2>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>Explore current roles and submit your application.</p>
                </div>
                {session ? (
                  <span style={{ fontSize: '0.8rem', color: primaryColor }}>Logged in as: <strong>{session.user.email}</strong></span>
                ) : (
                  <button
                    type="button"
                    style={{ padding: '0.45rem 1rem', border: `1.5px solid ${primaryColor}`, background: 'none', color: primaryColor, cursor: 'pointer', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}
                    onClick={() => {
                      setCandidateAuthMode('login');
                      setIsCandidateAuthOpen(true);
                    }}
                  >
                    Candidate Login
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {jobs.map(job => (
                  <div key={job.id} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0F172A' }}>{job.title}</h3>
                      <button
                        type="button"
                        style={{ padding: '0.5rem 1.25rem', backgroundColor: primaryColor, color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.82rem' }}
                        onClick={() => {
                          if (session) {
                            setSelectedJobForApplication(job);
                            setIsCareersPreviewOpen(false);
                          } else {
                            setSelectedJobForApplication(job);
                            setCandidateAuthMode('register');
                            setIsCandidateAuthOpen(true);
                          }
                        }}
                      >
                        Apply Now
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', backgroundColor: '#F1F5F9', color: '#475569', borderRadius: '4px' }}>📍 Bangalore, IN</span>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', backgroundColor: '#F1F5F9', color: '#475569', borderRadius: '4px' }}>💼 Full-Time</span>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', backgroundColor: '#F1F5F9', color: '#475569', borderRadius: '4px' }}>💰 Competitive package</span>
                    </div>

                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.82rem', color: '#334155' }}>
                      <pre style={{ fontFamily: 'inherit', margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{job.description}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
  
  // Sorted and Filtered results
  const NOTICE_ORDER = { 'Immediate': 0, '15 days': 1, '30 days': 2, '60 days': 3, '90 days': 4 };

  const completedCandidates = enrichedCandidates
    .filter(c => {
      // Always show in-progress and failed statuses
      if (c.status === 'screening' || c.status === 'failed') return true;
      if (c.status !== 'completed') return false;
      
      const dispScore = getCandidateDisplayScore(c);
      const outcome = getNextStepDetails(dispScore, threshold);

      // 1. Verdict filter (Shortlisted / Borderline / Not a fit)
      if (verdictFilter !== 'all' && outcome.badge !== verdictFilter) return false;

      // 2. Stage filter
      const candStage = c.stage || 'screening';
      if (stageFilter !== 'all' && candStage !== stageFilter) return false;

      // 3. Minimum ATS score
      if (dispScore < minScoreFilter) return false;
      
      // 4. Max expected CTC
      const expectedCtc = c.evaluation?.expected_ctc || c.expectedCtc || 0;
      if (expectedCtc > maxExpectedCtc) return false;
      
      // 5. Notice period filter
      const np = c.evaluation?.notice_period || c.noticePeriod || 'any';
      if (noticePeriodFilter !== 'any') {
        if (noticePeriodFilter === 'immediate' && np !== 'Immediate') return false;
        if (noticePeriodFilter === '15' && np !== 'Immediate' && np !== '15 days') return false;
        if (noticePeriodFilter === '30' && np !== 'Immediate' && np !== '15 days' && np !== '30 days') return false;
        if (noticePeriodFilter === '60' && np !== 'Immediate' && np !== '15 days' && np !== '30 days' && np !== '60 days') return false;
      }
      
      // 6. Location filter
      if (locationFilter.trim() !== '') {
        const locQuery = locationFilter.toLowerCase();
        const candLoc = (c.evaluation?.location || c.location || '').toLowerCase();
        const candPrefLoc = (c.evaluation?.preferred_location || c.preferredLocation || '').toLowerCase();
        if (!candLoc.includes(locQuery) && !candPrefLoc.includes(locQuery)) return false;
      }

      // 7. Skill cloud filters (must match ALL selected skills)
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
      
      // 8. Free-text search (name, email, resume text)
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const candidateName = (c.evaluation?.candidate_name || c.name || '').toLowerCase();
        const email = extractEmail(c).toLowerCase();
        const text = (c.text || '').toLowerCase();
        if (!candidateName.includes(query) && !email.includes(query) && !text.includes(query)) return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      // Always put in-progress statuses at top
      if (a.status === 'screening') return -1;
      if (b.status === 'screening') return 1;
      if (a.status === 'failed') return 1;
      if (b.status === 'failed') return -1;

      const aScore = getCandidateDisplayScore(a) || 0;
      const bScore = getCandidateDisplayScore(b) || 0;
      const aCtc = a.evaluation?.expected_ctc || a.expectedCtc || 0;
      const bCtc = b.evaluation?.expected_ctc || b.expectedCtc || 0;
      const aNp = a.evaluation?.notice_period || a.noticePeriod || '90 days';
      const bNp = b.evaluation?.notice_period || b.noticePeriod || '90 days';
      const aName = (a.evaluation?.candidate_name || a.name || '').toLowerCase();
      const bName = (b.evaluation?.candidate_name || b.name || '').toLowerCase();

      switch (sortBy) {
        case 'score_asc':   return aScore - bScore;
        case 'name_asc':    return aName.localeCompare(bName);
        case 'name_desc':   return bName.localeCompare(aName);
        case 'ctc_asc':     return aCtc - bCtc;
        case 'ctc_desc':    return bCtc - aCtc;
        case 'notice_asc':  return (NOTICE_ORDER[aNp] ?? 5) - (NOTICE_ORDER[bNp] ?? 5);
        case 'score_desc':  // fallthrough
        default:            return bScore - aScore;
      }
    });

  const completedScoredCandidates = completedCandidates.filter(c => c.status === 'completed');

  const renderRadarChart = (subscores = {}) => {
    const cx = 150;
    const cy = 135;
    const r = 90;
    const axes = [
      { key: 'Must-Haves', label: 'Must-Haves' },
      { key: 'JD Skills', label: 'JD Skills' },
      { key: 'Experience', label: 'Experience' },
      { key: 'Education', label: 'Education' },
      { key: 'Resume Quality', label: 'Resume Quality' },
      { key: 'Growth', label: 'Growth' }
    ];

    const getCoordinates = (index, value, maxVal = 100) => {
      const angle = index * (2 * Math.PI / axes.length) - Math.PI / 2;
      const radius = (value / maxVal) * r;
      return {
        x: Math.round(cx + radius * Math.cos(angle)),
        y: Math.round(cy + radius * Math.sin(angle))
      };
    };

    const gridLevels = [20, 40, 60, 80, 100];
    const gridPolygons = gridLevels.map(level => {
      return axes.map((_, index) => {
        const coords = getCoordinates(index, level);
        return `${coords.x},${coords.y}`;
      }).join(' ');
    });

    const candidatePoints = axes.map((axis, index) => {
      const val = subscores[axis.key] ?? 50;
      const coords = getCoordinates(index, val);
      return `${coords.x},${coords.y}`;
    }).join(' ');

    return (
      <div className="radar-chart-card animate-fade-in" style={{ width: '100%' }}>
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--color-ink-light)' }}>
          Scorecard Radar Breakdown
        </h4>
        <svg width="300" height="260" className="radar-chart-svg">
          {gridPolygons.map((points, i) => (
            <polygon 
              key={i} 
              points={points} 
              className="radar-grid-line" 
              style={{ strokeWidth: i === 4 ? '1.5px' : '1px' }}
            />
          ))}

          {axes.map((_, index) => {
            const outer = getCoordinates(index, 100);
            return (
              <line 
                key={index} 
                x1={cx} 
                y1={cy} 
                x2={outer.x} 
                y2={outer.y} 
                className="radar-axis-line" 
              />
            );
          })}

          <polygon points={candidatePoints} className="radar-polygon" />

          {axes.map((axis, index) => {
            const val = subscores[axis.key] ?? 50;
            const outer = getCoordinates(index, 118);
            const dot = getCoordinates(index, val);
            const scoreLabelCoords = getCoordinates(index, 134);
            
            let textAnchor = 'middle';
            if (outer.x < cx - 10) textAnchor = 'end';
            else if (outer.x > cx + 10) textAnchor = 'start';

            return (
              <g key={index}>
                <circle 
                  cx={dot.x} 
                  cy={dot.y} 
                  r="4" 
                  className="radar-dot" 
                  title={`${axis.label}: ${val}`}
                />
                
                <text 
                  x={outer.x} 
                  y={outer.y + 4} 
                  className="radar-label"
                  style={{ textAnchor }}
                >
                  {axis.label}
                </text>
                
                <text 
                  x={scoreLabelCoords.x} 
                  y={scoreLabelCoords.y + 4} 
                  className="radar-label-score"
                  style={{ textAnchor }}
                >
                  {val}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderAIAssistant = () => {
    if (!isChatbotOpen) return null;
    return (
      <div className="ai-assistant-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="ai-assistant-header">
          <div className="ai-assistant-title">
            <Sparkles size={18} />
            <span>RecruitPro AI</span>
          </div>
          <button 
            type="button" 
            className="ai-assistant-close-btn"
            onClick={() => setIsChatbotOpen(false)}
            title="Close Assistant"
          >
            <X size={16} />
          </button>
        </div>

        <div className="ai-assistant-messages scroll-container">
          {assistantMessages.map((msg, index) => (
            <div key={index} className={`chat-bubble ${msg.sender}`}>
              <div className="chat-text" style={{ whiteSpace: 'pre-wrap' }}>
                {msg.text.split('**').map((chunk, i) => i % 2 === 1 ? <strong key={i}>{chunk}</strong> : chunk)}
              </div>
              <div className="chat-timestamp">{msg.timestamp}</div>
            </div>
          ))}
        </div>

        <div className="ai-assistant-suggestions">
          {[
            "Who is the best fit?",
            "Show immediate joiners",
            "Filter React skills",
            "Summarize Rohan Mehta"
          ].map((prompt, i) => (
            <button
              key={i}
              type="button"
              className="prompt-chip"
              onClick={() => handleAssistantSubmit(null, prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="ai-assistant-input-area">
          <form onSubmit={handleAssistantSubmit} className="ai-assistant-input-form">
            <input
              type="text"
              className="ai-assistant-text-input"
              placeholder="Ask RecruitPro AI..."
              value={assistantInput}
              onChange={(e) => setAssistantInput(e.target.value)}
            />
            <button type="submit" className="ai-assistant-submit-btn">
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    );
  };

  const renderCandidateDashboard = () => {
    const dummyAssessments = candidateAssessments;
    const dummyMessages = candidateMessages;
    const dummyDocuments = candidateDocuments;
    const dummyNotifications = candidateNotifications;

    const handleApplySubmit = (e) => {
      e.preventDefault();
      if (!selectedJobForApplication || !candidateAppliedText.trim()) return;

      const userEmail = session?.user?.email || 'candidate@example.com';
      const candidateId = 'portal-' + Math.random().toString(36).substring(7);
      const text = `${userEmail.split('@')[0]}\nEmail: ${userEmail}\n\nResume Details:\n${candidateAppliedText}`;
      const tempCand = {
        id: candidateId, name: userEmail.split('@')[0], text,
        noticePeriod: null, currentCtc: null, expectedCtc: null, location: null,
        preferredLocation: null, resumeQuality: null, scorecard: null, activityLog: null
      };
      const evalData = analyzeCandidateOffline(tempCand, selectedJobForApplication.title, selectedJobForApplication.description, selectedJobForApplication.mustHaves);
      const timeStr = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const mockRatings = {
        recruiter: evalData.scorecard,
        technical: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "Awaiting technical interview review." },
        hr: { technical: 3, communication: 3, problemSolving: 3, cultureFit: 3, notes: "Awaiting HR round." }
      };
      const newCandidate = {
        id: candidateId, name: userEmail.split('@')[0],
        fileName: `${selectedJobForApplication.title.replace(/\s+/g, '_')}_Resume.txt`,
        fileSize: candidateAppliedText.length, status: 'completed', ocrProgress: 0, text,
        numChars: candidateAppliedText.length, errorDetails: '', score: evalData.calculatedScore,
        evaluation: evalData, stage: 'screening', noticePeriod: evalData.notice_period,
        currentCtc: evalData.current_ctc, expectedCtc: evalData.expected_ctc,
        location: evalData.location, preferredLocation: evalData.preferred_location,
        resumeQuality: evalData.resume_quality, scorecard: evalData.scorecard,
        activityLog: [
          { id: 1, type: "applied", text: `Candidate applied via Portal for job: ${selectedJobForApplication.title}`, timestamp: timeStr },
          { id: 2, type: "screened", text: `ATS Match Screen complete. ATS Score: ${evalData.calculatedScore}%`, timestamp: timeStr }
        ],
        jobsData: {
          [selectedJobForApplication.id]: {
            score: evalData.calculatedScore, evaluation: evalData, stage: 'screening',
            scorecard: evalData.scorecard, collaboratorRatings: mockRatings,
            activityLog: [
              { id: 1, type: "applied", text: `Candidate applied via Portal for job: ${selectedJobForApplication.title}`, timestamp: timeStr },
              { id: 2, type: "screened", text: `ATS Match Screen complete. ATS Score: ${evalData.calculatedScore}%`, timestamp: timeStr }
            ]
          }
        }
      };
      setCandidates(prev => [...prev, newCandidate]);
      setCandidateAppliedText('');
      setSelectedJobForApplication(null);
      setActiveCandidateNavTab('applications');
      alert(`🎉 Application submitted for ${selectedJobForApplication.title}! ATS Score: ${evalData.calculatedScore}%`);
    };

    const userName = (session?.user?.email || 'candidate@example.com').split('@')[0];
    const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);
    const candidateApplications = candidates.filter(c => extractEmail(c).toLowerCase() === (session?.user?.email || 'candidate@example.com').toLowerCase());

    const dummyInterviews = candidateApplications.flatMap(c => {
      const jIds = Object.keys(c.jobsData || {});
      return jIds.map(jId => {
        const jd = c.jobsData[jId];
        if (!jd?.interview) return null;
        const job = jobs.find(j => j.id === jId) || { title: 'Position' };
        return { ...jd.interview, jobTitle: job.title, candName: c.name };
      }).filter(Boolean);
    });
    const dummyOffers = candidateApplications.flatMap(c => {
      const jIds = Object.keys(c.jobsData || {});
      return jIds.map(jId => {
        const jd = c.jobsData[jId];
        if (jd?.stage !== 'offer_extended' && jd?.stage !== 'hired') return null;
        const job = jobs.find(j => j.id === jId) || { title: 'Position' };
        return { ...jd, jobTitle: job.title, candidateId: c.id, jId };
      }).filter(Boolean);
    });
    const recommendedJobs = [
      { id: 'rec-1', title: 'Senior React Developer', company: 'Google', location: 'Bangalore / Remote', salary: '40–55 LPA', match: 94, tags: ['React', 'TypeScript', 'GraphQL'] },
      { id: 'rec-2', title: 'Frontend Architect', company: 'Meta', location: 'Hyderabad', salary: '35–50 LPA', match: 89, tags: ['React', 'Redux', 'Performance'] },
      { id: 'rec-3', title: 'Full Stack Engineer', company: 'Flipkart', location: 'Bangalore', salary: '28–38 LPA', match: 82, tags: ['React', 'Node.js', 'AWS'] },
      { id: 'rec-4', title: 'UI/UX Lead Engineer', company: 'Razorpay', location: 'Remote', salary: '25–35 LPA', match: 78, tags: ['React', 'Design Systems', 'CSS'] },
    ];

    const interviewPrepTopics = [
      { id: 1, topic: 'React Deep Dive', questions: 25, difficulty: 'Advanced', progress: 60 },
      { id: 2, topic: 'System Design Fundamentals', questions: 15, difficulty: 'Advanced', progress: 30 },
      { id: 3, topic: 'JavaScript & TypeScript', questions: 40, difficulty: 'Intermediate', progress: 85 },
      { id: 4, topic: 'Behavioral & HR Questions', questions: 20, difficulty: 'Easy', progress: 40 },
    ];

    const navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      { id: 'profile', label: 'My Profile', icon: <User size={18} /> },
      { id: 'resume', label: 'Resume Center', icon: <FileText size={18} /> },
      { id: 'jobs', label: 'Job Search', icon: <Search size={18} /> },
      { id: 'saved', label: 'Saved Jobs', icon: <Bookmark size={18} />, badge: savedJobIds.length || 0 },
      { id: 'recommended', label: 'Recommended Jobs', icon: <Star size={18} />, badge: recommendedJobs.length },
      { id: 'applications', label: 'Applications', icon: <ClipboardList size={18} />, badge: candidateApplications.length },
      { id: 'assessments', label: 'Assessments', icon: <Award size={18} />, badge: dummyAssessments.filter(a => a.status === 'pending').length },
      { id: 'interviews', label: 'Interviews', icon: <Calendar size={18} />, badge: dummyInterviews.length },
      { id: 'offers', label: 'Offers', icon: <Briefcase size={18} />, badge: dummyOffers.length },
      { id: 'documents', label: 'Documents', icon: <Folder size={18} /> },
      { id: 'messages', label: 'Messages', icon: <MessageSquare size={18} />, badge: dummyMessages.filter(m => m.unread).length },
      { id: 'notifications', label: 'Notifications', icon: <Bell size={18} />, badge: dummyNotifications.filter(n => n.unread).length },
      { id: 'ai-assistant', label: 'AI Career Assistant', icon: <Bot size={18} /> },
      { id: 'ai-interview', label: 'AI Interview Prep', icon: <Target size={18} /> },
      { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
    ];

    const renderPortalContent = () => {
      switch (activeCandidateNavTab) {
        case 'dashboard': return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Welcome Banner */}
            <div className="cp-welcome-banner">
              <div>
                <h1 className="cp-welcome-title">Welcome back, {displayName}! 👋</h1>
                <p className="cp-welcome-sub">Your career journey at a glance. {candidateApplications.length > 0 ? `You have ${candidateApplications.length} active application(s).` : 'Start applying to jobs today!'}</p>
              </div>
              <div className="cp-welcome-avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {candidateProfileData.avatarUrl ? (
                  <img src={candidateProfileData.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="cp-stats-grid">
              {[
                { label: 'Applications', value: candidateApplications.length, icon: <ClipboardList size={18} />, color: '#6366f1' },
                { label: 'Profile Views', value: 47, icon: <Eye size={18} />, color: '#8b5cf6' },
                { label: 'Saved Jobs', value: savedJobIds.length, icon: <Bookmark size={18} />, color: '#ec4899' },
                { label: 'Interviews', value: dummyInterviews.length, icon: <Calendar size={18} />, color: '#f59e0b' },
              ].map(stat => (
                <div key={stat.label} className="cp-stat-card">
                  <div className="cp-stat-icon" style={{ background: stat.color + '20', color: stat.color }}>{stat.icon}</div>
                  <div className="cp-stat-value" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="cp-stat-label">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Two Column: Applications + Recommended */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Recent Applications */}
              <div className="cp-section-card">
                <div className="cp-section-header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ClipboardList size={15} style={{ color: 'var(--color-terracotta)' }} /> Recent Applications
                  </span>
                  <button className="cp-link-btn" onClick={() => setActiveCandidateNavTab('applications')}>View All <ChevronRight size={14} /></button>
                </div>
                {candidateApplications.length === 0 ? (
                  <div className="cp-empty-state">
                    <div style={{ fontSize: '2.5rem' }}>📭</div>
                    <p>No applications yet. Browse jobs and apply!</p>
                    <button className="cp-action-btn" onClick={() => setActiveCandidateNavTab('jobs')}>Browse Jobs</button>
                  </div>
                ) : (
                  candidateApplications.slice(0, 3).map(cand => {
                    const jIds = Object.keys(cand.jobsData || {});
                    const jId = jIds[0] || 'job-1';
                    const jd = cand.jobsData?.[jId] || {};
                    const stage = jd.stage || cand.stage || 'screening';
                    const job = jobs.find(j => j.id === jId) || jobs[0];
                    const stageColors = { screening: '#6366f1', shortlisted: '#10b981', interviewing: '#f59e0b', offer_extended: '#f97316', hired: '#22c55e', rejected: '#ef4444' };
                    return (
                      <div key={cand.id} className="cp-app-row">
                        <div className="cp-app-row-left">
                          <div className="cp-app-company-logo">{job?.title?.charAt(0)}</div>
                          <div>
                            <div className="cp-app-title">{job?.title}</div>
                            <div className="cp-app-date">Applied {cand.created_at ? new Date(cand.created_at).toLocaleDateString() : 'Recently'}</div>
                          </div>
                        </div>
                        <span className="cp-stage-badge" style={{ background: (stageColors[stage] || '#6366f1') + '20', color: stageColors[stage] || '#6366f1' }}>{stage.replace('_', ' ')}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Recommended Jobs */}
              <div className="cp-section-card">
                <div className="cp-section-header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Star size={15} style={{ color: 'var(--color-gold)' }} /> Recommended for You
                  </span>
                  <button className="cp-link-btn" onClick={() => setActiveCandidateNavTab('recommended')}>View All <ChevronRight size={14} /></button>
                </div>
                {recommendedJobs.slice(0, 3).map(j => (
                  <div key={j.id} className="cp-app-row">
                    <div className="cp-app-row-left">
                      <div className="cp-app-company-logo" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>{j.company.charAt(0)}</div>
                      <div>
                        <div className="cp-app-title">{j.title}</div>
                        <div className="cp-app-date">{j.company} · {j.location}</div>
                      </div>
                    </div>
                    <span className="cp-match-badge">{j.match}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Interviews */}
            {dummyInterviews.length > 0 && (
              <div className="cp-section-card">
                <div className="cp-section-header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={15} style={{ color: 'var(--color-gold)' }} /> Upcoming Interviews
                  </span>
                </div>
                {dummyInterviews.map((iv, idx) => (
                  <div key={idx} className="cp-interview-row">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f59e0b20', color: '#f59e0b', width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0 }}>
                      <Calendar size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700' }}>{iv.jobTitle}</div>
                      <div className="cp-app-date">Interviewer: {iv.interviewer} · {new Date(iv.dateTime).toLocaleString()}</div>
                      <div className="cp-app-date" style={{ fontStyle: 'italic' }}>Agenda: {iv.agenda}</div>
                    </div>
                    <span className="cp-stage-badge" style={{ background: '#f59e0b20', color: '#f59e0b' }}>Scheduled</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

        case 'profile': {
          let fieldsCount = 0;
          let filledCount = 0;
          const fields = ['fullName', 'phone', 'location', 'headline', 'bio', 'skills', 'experience', 'education', 'avatarUrl', 'linkedin', 'github', 'portfolio'];
          fields.forEach(f => {
            fieldsCount++;
            if (candidateProfileData[f] && candidateProfileData[f].toString().trim() !== '') {
              filledCount++;
            }
          });
          const completionPercentage = Math.round((filledCount / fieldsCount) * 100);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="cp-page-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><User size={20} style={{ color: '#6366f1' }} /> My Profile</h2><p>Complete your profile to increase visibility to recruiters.</p></div>
              
              {/* Profile Completion */}
              <div className="cp-section-card">
                <div className="cp-section-header"><span>Profile Completion</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                  {candidateProfileData.avatarUrl ? (
                    <img src={candidateProfileData.avatarUrl} alt="Avatar" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #6366f1' }} />
                  ) : (
                    <div className="cp-profile-avatar">{displayName.charAt(0)}</div>
                  )}
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>{candidateProfileData.fullName || displayName}</div>
                    <div style={{ color: 'var(--color-ink-muted)', fontSize: '0.82rem' }}>{session.user.email}</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: completionPercentage < 70 ? '#f59e0b' : '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <AlertCircle size={14} /> Profile {completionPercentage}% complete — {completionPercentage < 100 ? 'Add more details to attract recruiters!' : 'Perfect! Your profile is complete.'}
                    </div>
                  </div>
                </div>
                <div className="cp-progress-bar-track"><div className="cp-progress-bar-fill" style={{ width: `${completionPercentage}%` }} /></div>
              </div>

              {/* Profile Avatar Options */}
              <div className="cp-section-card">
                <div className="cp-section-header"><span>Profile Picture & Avatar</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {[
                      { name: 'Sofia (Lead)', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80' },
                      { name: 'Alex (Dev)', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80' },
                      { name: 'Maya (Designer)', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80' },
                      { name: 'David (PM)', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&h=150&q=80' },
                      { name: 'Sarah (Frontend)', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80' },
                    ].map(avatar => {
                      const isSelected = candidateProfileData.avatarUrl === avatar.url;
                      return (
                        <button key={avatar.name} type="button" style={{ position: 'relative', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                          onClick={() => setCandidateProfileData(p => ({ ...p, avatarUrl: avatar.url }))}>
                          <img src={avatar.url} alt={avatar.name} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: isSelected ? '3px solid #6366f1' : '2px solid transparent', padding: '2px', transition: 'border-color 0.2s' }} />
                          {isSelected && <span style={{ position: 'absolute', bottom: 0, right: 0, background: '#6366f1', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>✓</span>}
                        </button>
                      );
                    })}
                    <input type="file" id="candidate-avatar-file-input" accept="image/*" style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            alert('Image size exceeds 2MB limit.');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (uploadEvent) => {
                            setCandidateProfileData(p => ({ ...p, avatarUrl: uploadEvent.target.result }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }} />
                    <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      onClick={() => document.getElementById('candidate-avatar-file-input').click()}>
                      <Upload size={13} /> Upload File...
                    </button>
                    <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                      onClick={() => {
                        const customUrl = prompt('Enter image URL:');
                        if (customUrl) setCandidateProfileData(p => ({ ...p, avatarUrl: customUrl }));
                      }}>
                      Custom URL...
                    </button>
                    {candidateProfileData.avatarUrl && (
                      <button type="button" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', borderRadius: '6px' }}
                        onClick={() => setCandidateProfileData(p => ({ ...p, avatarUrl: '' }))}>
                        Clear Pic
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Basic Info */}
              <div className="cp-section-card">
                <div className="cp-section-header"><span>Basic Information</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {[
                    { label: 'Full Name', key: 'fullName', placeholder: `${displayName} Sharma` },
                    { label: 'Phone Number', key: 'phone', placeholder: '+91 98765 43210' },
                    { label: 'Location', key: 'location', placeholder: 'Bangalore, India' },
                    { label: 'Professional Headline', key: 'headline', placeholder: 'Senior React Developer | 5+ Years' },
                  ].map(field => (
                    <div key={field.key} className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label text-xs">{field.label}</label>
                      <input type="text" className="input-text" placeholder={field.placeholder}
                        value={candidateProfileData[field.key] || ''}
                        onChange={e => setCandidateProfileData(p => ({ ...p, [field.key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div className="form-group" style={{ marginBottom: 0, marginTop: '1rem' }}>
                  <label className="form-label text-xs">Professional Bio</label>
                  <textarea className="input-textarea" style={{ minHeight: '80px' }} placeholder="Write a brief professional summary..."
                    value={candidateProfileData.bio || ''}
                    onChange={e => setCandidateProfileData(p => ({ ...p, bio: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0, marginTop: '1rem' }}>
                  <label className="form-label text-xs">Key Skills (comma separated)</label>
                  <input type="text" className="input-text" placeholder="React, TypeScript, Node.js, AWS, Redux"
                    value={candidateProfileData.skills || ''}
                    onChange={e => setCandidateProfileData(p => ({ ...p, skills: e.target.value }))} />
                </div>
              </div>

              {/* Work & Education Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="cp-section-card" style={{ margin: 0 }}>
                  <div className="cp-section-header"><span>Work Experience</span></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label text-xs">Job Title / Role</label>
                      <input type="text" className="input-text" placeholder="Software Engineer"
                        value={candidateProfileData.experience || ''}
                        onChange={e => setCandidateProfileData(p => ({ ...p, experience: e.target.value }))} />
                    </div>
                  </div>
                </div>

                <div className="cp-section-card" style={{ margin: 0 }}>
                  <div className="cp-section-header"><span>Education</span></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label text-xs">Degree & School</label>
                      <input type="text" className="input-text" placeholder="B.Tech in Computer Science, IIT"
                        value={candidateProfileData.education || ''}
                        onChange={e => setCandidateProfileData(p => ({ ...p, education: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Professional & Social Links */}
              <div className="cp-section-card">
                <div className="cp-section-header"><span>Professional Links</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  {[
                    { label: 'LinkedIn Profile', key: 'linkedin', placeholder: 'https://linkedin.com/in/username' },
                    { label: 'GitHub Profile', key: 'github', placeholder: 'https://github.com/username' },
                    { label: 'Portfolio URL', key: 'portfolio', placeholder: 'https://username.dev' },
                  ].map(link => (
                    <div key={link.key} className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label text-xs">{link.label}</label>
                      <input type="text" className="input-text" placeholder={link.placeholder}
                        value={candidateProfileData[link.key] || ''}
                        onChange={e => setCandidateProfileData(p => ({ ...p, [link.key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <button className="cp-action-btn" style={{ marginTop: '1.5rem', width: 'auto', padding: '0.6rem 2.25rem' }}
                  onClick={async () => {
                    await saveCandidateMetadata(candidateProfileData, null, null);
                    alert('Profile saved successfully!');
                  }}>Save Profile Changes</button>
              </div>
            </div>
          );
        }

        case 'resume': return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="cp-page-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={20} style={{ color: '#6366f1' }} /> Resume Center</h2><p>Manage your resumes and cover letters.</p></div>
            <div className="cp-section-card">
              <div className="cp-section-header"><span>Upload New Resume</span></div>
              <div className="cp-upload-zone" onClick={() => document.getElementById('candidate-resume-uploader').click()} style={{ cursor: 'pointer' }}>
                <Upload size={36} style={{ color: '#6366f1', marginBottom: '0.75rem' }} />
                <div style={{ fontWeight: '700', marginBottom: '0.25rem' }}>Drag & Drop or Click to Upload</div>
                <div className="cp-app-date">PDF, DOCX, TXT up to 5MB</div>
                <input type="file" id="candidate-resume-uploader" onChange={handleCandidateFileUpload} style={{ display: 'none' }} accept=".pdf,.docx,.txt" />
              </div>
              
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <button type="button" className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.78rem' }} onClick={() => setPasteFallbackOpen(!pasteFallbackOpen)}>
                  {pasteFallbackOpen ? 'Hide Paste Form' : 'Paste Resume Text instead'}
                </button>
              </div>

              {pasteFallbackOpen && (
                <div style={{ marginTop: '1rem', background: 'var(--color-paper-light)', border: '1px dashed var(--color-border)', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Paste Resume Text:</div>
                  <input type="text" className="input-text" placeholder="Document Name (e.g. My_React_Resume.txt)" value={pasteName} onChange={e => setPasteName(e.target.value)} style={{ marginBottom: '0.75rem' }} />
                  <textarea className="input-textarea" placeholder="Paste resume copy here..." value={pasteText} onChange={e => setPasteText(e.target.value)} style={{ minHeight: '120px', marginBottom: '0.75rem' }} />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="cp-action-btn" style={{ width: 'auto', padding: '0.4rem 1.25rem' }} onClick={handleCandidatePasteUpload} disabled={!pasteText.trim()}>Save Document</button>
                    <button className="btn-secondary" style={{ padding: '0.4rem 1rem' }} onClick={() => { setPasteFallbackOpen(false); setPasteName(''); setPasteText(''); }}>Cancel</button>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '1.5rem' }}>
                <div className="cp-section-header"><span>Your Documents</span></div>
                {dummyDocuments.map(doc => (
                  <div key={doc.id} className="cp-doc-row">
                    <span style={{ fontSize: '1.5rem' }}>{doc.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.88rem' }}>{doc.name}</div>
                      <div className="cp-app-date">{doc.type} · {doc.size} · {doc.date}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="cp-action-btn-sm" onClick={() => alert(`Downloading ${doc.name}...`)}>Download</button>
                      <button className="cp-action-btn-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }} onClick={() => { setCandidateDocuments(prev => prev.filter(d => d.id !== doc.id)); alert('Document deleted!'); }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

        case 'jobs': return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="cp-page-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Search size={20} style={{ color: '#6366f1' }} /> Job Search</h2><p>Explore all available job openings.</p></div>
            <div className="cp-section-card">
              <input type="text" className="input-text" style={{ marginBottom: '1rem' }} placeholder="Search by title, skill, or company..." />
              {jobs.map(job => {
                const alreadyApplied = candidateApplications.some(c => c.jobsData && c.jobsData[job.id]);
                const isSaved = savedJobIds.includes(job.id);
                return (
                  <div key={job.id} className="cp-job-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                          <div className="cp-app-company-logo">{job.title.charAt(0)}</div>
                          <div>
                            <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>{job.title}</div>
                            <div className="cp-app-date">RecruiterPro Corp · Bangalore, India · Full-time</div>
                          </div>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--color-ink-light)', margin: '0.5rem 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {job.description.split('\n')[0]}
                        </p>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                          {(job.mustHaves || '').split(',').slice(0, 4).map(tag => (
                            <span key={tag} style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: '4px', fontWeight: '600' }}>{tag.trim()}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', marginLeft: '1rem' }}>
                        {alreadyApplied ? (
                          <span className="cp-stage-badge" style={{ background: '#10b98120', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><Check size={14} /> Applied</span>
                        ) : (
                          <button className="cp-action-btn" style={{ fontSize: '0.78rem', padding: '0.4rem 1rem' }}
                            onClick={() => { setSelectedJobForApplication(job); setActiveCandidateNavTab('apply'); }}>Apply Now</button>
                        )}
                        <button className="cp-action-btn-sm" style={{ background: isSaved ? '#f59e0b20' : undefined, color: isSaved ? '#f59e0b' : undefined, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          onClick={async () => {
                            const nextSaved = isSaved ? savedJobIds.filter(id => id !== job.id) : [...savedJobIds, job.id];
                            setSavedJobIds(nextSaved);
                            await saveCandidateMetadata(null, nextSaved, null);
                          }}>
                          <Bookmark size={13} /> {isSaved ? 'Saved' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

        case 'apply': return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="cp-page-header">
              <button className="cp-link-btn" style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => { setSelectedJobForApplication(null); setActiveCandidateNavTab('jobs'); }}><ChevronLeft size={14} /> Back to Jobs</button>
              <h2>Apply for: {selectedJobForApplication?.title}</h2>
            </div>
            <div className="cp-section-card">
              <div className="apply-card" style={{ margin: 0, border: 'none', padding: 0, boxShadow: 'none' }}>
                <div style={{ background: 'var(--color-paper-light)', border: '1px solid var(--color-border)', padding: '1rem', borderRadius: '6px' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>Job Description</h4>
                  <pre style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-ink-light)', fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>{selectedJobForApplication?.description}</pre>
                </div>
                <form onSubmit={handleApplySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label text-xs">Email Address (Pre-filled)</label>
                    <input type="text" className="input-text" value={session.user.email} disabled />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label text-xs">Paste Resume Content</label>
                    <textarea className="input-textarea" style={{ minHeight: '220px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                      placeholder="Paste full text contents of your resume (experience, education, and skills)..."
                      value={candidateAppliedText} onChange={e => setCandidateAppliedText(e.target.value)} required />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="submit" className="cp-action-btn" style={{ width: 'auto', padding: '0.6rem 2rem' }}>Submit Application</button>
                    <button type="button" className="btn-secondary" style={{ padding: '0.6rem 1.5rem' }} onClick={() => { setSelectedJobForApplication(null); setActiveCandidateNavTab('jobs'); }}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );

        case 'saved': return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="cp-page-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Bookmark size={20} style={{ color: '#6366f1' }} /> Saved Jobs</h2><p>{savedJobIds.length} saved job(s) ready to apply.</p></div>
            {savedJobIds.length === 0 ? (
              <div className="cp-section-card">
                <div className="cp-empty-state">
                  <Bookmark size={48} style={{ color: 'var(--color-ink-muted)', opacity: 0.4 }} />
                  <p>No saved jobs yet. Browse jobs and save the ones you like!</p>
                  <button className="cp-action-btn" onClick={() => setActiveCandidateNavTab('jobs')}>Browse Jobs</button>
                </div>
              </div>
            ) : (
              jobs.filter(j => savedJobIds.includes(j.id)).map(job => (
                <div key={job.id} className="cp-section-card">
                  <div className="cp-section-header">
                    <span style={{ fontWeight: '800' }}>{job.title}</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="cp-action-btn" style={{ fontSize: '0.78rem', padding: '0.4rem 1rem' }}
                        onClick={() => { setSelectedJobForApplication(job); setActiveCandidateNavTab('apply'); }}>Apply Now</button>
                      <button className="cp-action-btn-sm" style={{ background: '#ef444410', color: '#ef4444' }}
                        onClick={async () => {
                          const nextSaved = savedJobIds.filter(id => id !== job.id);
                          setSavedJobIds(nextSaved);
                          await saveCandidateMetadata(null, nextSaved, null);
                        }}>Remove</button>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-ink-light)', margin: 0 }}>{job.description.split('\n')[0]}</p>
                </div>
              ))
            )}
          </div>
        );

        case 'recommended': return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="cp-page-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Star size={20} style={{ color: '#6366f1' }} /> Recommended Jobs</h2><p>Jobs curated by AI based on your profile and skills.</p></div>
            {recommendedJobs.map(j => (
              <div key={j.id} className="cp-section-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'start' }}>
                    <div className="cp-app-company-logo" style={{ width: '48px', height: '48px', fontSize: '1.4rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }}>{j.company.charAt(0)}</div>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '1rem' }}>{j.title}</div>
                      <div className="cp-app-date">{j.company} · {j.location}</div>
                      <div style={{ color: '#10b981', fontWeight: '700', fontSize: '0.82rem', marginTop: '0.2rem' }}>{j.salary}</div>
                      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        {j.tags.map(t => <span key={t} style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: '4px', fontWeight: '600' }}>{t}</span>)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                    <div className="cp-match-badge" style={{ fontSize: '1rem', padding: '0.4rem 0.75rem' }}>{j.match}% Match</div>
                    <button className="cp-action-btn" style={{ fontSize: '0.78rem', padding: '0.4rem 1rem' }} onClick={() => handleQuickApply(j)}>Quick Apply</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

        case 'applications': return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="cp-page-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ClipboardList size={20} style={{ color: '#6366f1' }} /> My Applications</h2><p>{candidateApplications.length} active application(s).</p></div>
            {candidateApplications.length === 0 ? (
              <div className="cp-section-card"><div className="cp-empty-state">
                <FolderOpen size={48} style={{ color: 'var(--color-ink-muted)', opacity: 0.4 }} />
                <p>No applications yet. Start applying to open positions!</p>
                <button className="cp-action-btn" onClick={() => setActiveCandidateNavTab('jobs')}>Browse Jobs</button>
              </div></div>
            ) : candidateApplications.map(cand => {
              const jIds = Object.keys(cand.jobsData || {});
              const jId = jIds[0] || 'job-1';
              const jd = cand.jobsData?.[jId] || {};
              const stage = jd.stage || cand.stage || 'screening';
              const job = jobs.find(j => j.id === jId) || jobs[0];
              const stageColors = { screening: '#6366f1', shortlisted: '#10b981', interviewing: '#f59e0b', offer_extended: '#f97316', hired: '#22c55e', rejected: '#ef4444' };
              const stages = ['screening', 'shortlisted', 'interviewing', 'offer_extended', 'hired'];
              const stageIdx = stages.indexOf(stage);
              const isOffer = stage === 'offer_extended';
              const isHired = stage === 'hired';
              return (
                <div key={cand.id} className="cp-section-card" style={{ borderLeft: `4px solid ${stageColors[stage] || '#6366f1'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '1.05rem' }}>{job?.title}</div>
                      <div className="cp-app-date">Applied {cand.created_at ? new Date(cand.created_at).toLocaleDateString() : 'Recently'} · ATS Score: <strong style={{ color: '#6366f1' }}>{cand.score || jd.score || 0}%</strong></div>
                    </div>
                    <span className="cp-stage-badge" style={{ background: (stageColors[stage] || '#6366f1') + '20', color: stageColors[stage] || '#6366f1', fontSize: '0.78rem', padding: '0.3rem 0.75rem' }}>
                      {isHired ? 'Hired' : isOffer ? 'Offer Extended' : stage.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0' }}>
                      {stages.map((s, i) => (
                        <div key={s} style={{ flex: 1, height: '4px', background: i <= stageIdx ? (stageColors[stage] || '#6366f1') : 'var(--color-border)', borderRadius: i === 0 ? '4px 0 0 4px' : i === stages.length - 1 ? '0 4px 4px 0' : '0', transition: 'background 0.3s' }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem' }}>
                      {stages.map((s, i) => <span key={s} style={{ fontSize: '0.62rem', color: i <= stageIdx ? 'var(--color-ink-light)' : 'var(--color-ink-muted)', fontWeight: i === stageIdx ? '700' : '400' }}>{s.replace('_', ' ')}</span>)}
                    </div>
                  </div>
                  {jd.interview && (
                    <div style={{ marginTop: '0.75rem', background: '#f59e0b10', border: '1px solid #f59e0b40', borderRadius: '6px', padding: '0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Calendar size={14} style={{ color: '#f59e0b' }} /> <strong>Interview:</strong> {new Date(jd.interview.dateTime).toLocaleString()} with {jd.interview.interviewer}
                    </div>
                  )}
                  {isOffer && jd.offerDetails && (
                    <div style={{ marginTop: '0.75rem', background: '#f9731610', border: '1px solid #f9731640', borderRadius: '6px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#f97316', display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Sparkles size={16} /> Job Offer: {jd.offerDetails.salaryLpa} LPA — Join {jd.offerDetails.joiningDate}</span>
                      <button className="cp-action-btn" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', background: '#f97316', width: 'auto' }}
                        onClick={() => { setActiveOfferCandidateId(cand.id); setOfferSalaryLpa(jd.offerDetails.salaryLpa); setOfferJoiningDate(jd.offerDetails.joiningDate); setOfferNotes(jd.offerDetails.notes || ''); }}>
                        Review & Sign Offer
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );

        case 'assessments': return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="cp-page-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Award size={20} style={{ color: '#6366f1' }} /> Assessments</h2><p>Complete skill assessments to boost your profile.</p></div>
            {dummyAssessments.map(a => (
              <div key={a.id} className="cp-section-card" style={{ borderLeft: `4px solid ${a.status === 'completed' ? '#10b981' : '#6366f1'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '1rem' }}>{a.title}</div>
                    <div className="cp-app-date">{a.company} · {a.duration} · {a.questions} questions · {a.difficulty}</div>
                    {a.status === 'pending' && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><AlertTriangle size={12} /> Due: {a.dueDate}</div>}
                    {a.status === 'completed' && <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={12} /> Score: {a.score}/100</div>}
                  </div>
                  {a.status === 'pending' ? (
                    <button className="cp-action-btn" style={{ fontSize: '0.78rem', padding: '0.4rem 1rem' }} onClick={() => setActiveAssessmentQuiz(a)}>Start Now</button>
                  ) : (
                    <span className="cp-stage-badge" style={{ background: '#10b98120', color: '#10b981' }}>Completed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        );

        case 'interviews': return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="cp-page-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Calendar size={20} style={{ color: '#6366f1' }} /> Interviews</h2><p>Track all your scheduled and past interviews.</p></div>
            {dummyInterviews.length === 0 ? (
              <div className="cp-section-card"><div className="cp-empty-state">
                <Calendar size={48} style={{ color: 'var(--color-ink-muted)', opacity: 0.4 }} />
                <p>No interviews scheduled yet. Keep applying and you'll get one soon!</p>
              </div></div>
            ) : dummyInterviews.map((iv, idx) => (
              <div key={idx} className="cp-section-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '1rem' }}>{iv.jobTitle}</div>
                    <div className="cp-app-date">Interviewer: {iv.interviewer}</div>
                    <div className="cp-app-date" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Calendar size={13} /> {new Date(iv.dateTime).toLocaleString()}</div>
                    <div className="cp-app-date" style={{ fontStyle: 'italic' }}>Agenda: {iv.agenda}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <span className="cp-stage-badge" style={{ background: '#f59e0b20', color: '#f59e0b' }}>Upcoming</span>
                    <button className="cp-action-btn" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => setActivePracticeTopic({ id: 1, topic: 'React Deep Dive', questions: 25, difficulty: 'Advanced', progress: 60 })}>Prep with AI <Sparkles size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

        case 'offers': return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="cp-page-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Briefcase size={20} style={{ color: '#6366f1' }} /> Offers</h2><p>Review and sign your job offer letters.</p></div>
            {dummyOffers.length === 0 ? (
              <div className="cp-section-card"><div className="cp-empty-state">
                <Briefcase size={48} style={{ color: 'var(--color-ink-muted)', opacity: 0.4 }} />
                <p>No offers yet. Keep going — you're almost there!</p>
              </div></div>
            ) : dummyOffers.map((offer, idx) => {
              const cand = candidateApplications.find(c => c.id === offer.candidateId);
              return (
                <div key={idx} className="cp-section-card" style={{ borderLeft: '4px solid #f97316' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Sparkles size={16} style={{ color: '#f97316' }} /> Job Offer: {offer.jobTitle}</div>
                      <div className="cp-app-date">Package: <strong style={{ color: '#10b981' }}>{offer.offerDetails?.salaryLpa} LPA</strong></div>
                      <div className="cp-app-date">Joining: {offer.offerDetails?.joiningDate}</div>
                      {offer.stage === 'hired' && <div style={{ color: '#22c55e', fontWeight: '700', marginTop: '0.25rem' }}>ACCEPTED — You are officially Hired!</div>}
                    </div>
                    {offer.stage === 'offer_extended' && cand && (
                      <button className="cp-action-btn" style={{ background: '#f97316', width: 'auto' }}
                        onClick={() => { setActiveOfferCandidateId(cand.id); setOfferSalaryLpa(offer.offerDetails?.salaryLpa); setOfferJoiningDate(offer.offerDetails?.joiningDate); setOfferNotes(offer.offerDetails?.notes || ''); }}>
                        Review & Sign Offer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );

        case 'documents': {
          const renderDocIcon = (type) => {
            switch (type) {
              case 'Resume': return <FileText size={20} style={{ color: '#6366f1' }} />;
              case 'Cover Letter': return <FileCheck size={20} style={{ color: '#10b981' }} />;
              case 'Portfolio': return <Folder size={20} style={{ color: '#f59e0b' }} />;
              case 'Certificate': return <Award size={20} style={{ color: '#8b5cf6' }} />;
              default: return <FileText size={20} style={{ color: '#64748b' }} />;
            }
          };
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="cp-page-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Folder size={20} style={{ color: '#6366f1' }} /> Documents</h2><p>Manage your resumes, certificates, and cover letters.</p></div>
              <div className="cp-section-card">
                {dummyDocuments.map(doc => (
                  <div key={doc.id} className="cp-doc-row">
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'var(--color-paper-darker)', borderRadius: '8px' }}>
                      {renderDocIcon(doc.type)}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700' }}>{doc.name}</div>
                      <div className="cp-app-date">{doc.type} · {doc.size} · Uploaded {doc.date}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="cp-action-btn-sm" onClick={() => alert(`Downloading ${doc.name}...`)}>Download</button>
                      <button className="cp-action-btn-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => { setCandidateDocuments(prev => prev.filter(d => d.id !== doc.id)); alert('Document deleted!'); }}><Trash2 size={13} /> Delete</button>
                    </div>
                  </div>
                ))}
                <button className="cp-action-btn" style={{ width: 'auto', marginTop: '0.5rem' }} onClick={() => setActiveCandidateNavTab('resume')}>+ Upload New Document</button>
              </div>
            </div>
          );
        }

        case 'messages': return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="cp-page-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MessageSquare size={20} style={{ color: '#6366f1' }} /> Messages</h2><p>{dummyMessages.filter(m => m.unread).length} unread message(s).</p></div>
            <div className="cp-section-card" style={{ padding: 0, overflow: 'hidden' }}>
              {dummyMessages.map((msg, idx) => (
                <div key={msg.id} className="cp-message-row" style={{ borderBottom: idx < dummyMessages.length - 1 ? '1px solid var(--color-border)' : 'none', background: msg.unread ? 'var(--color-paper-light)' : 'transparent', cursor: 'pointer' }}
                  onClick={() => {
                    setActiveChatMsg(msg);
                    setCandidateMessages(prev => prev.map(m => m.id === msg.id ? { ...m, unread: false } : m));
                  }}>
                  <div className="cp-msg-avatar" style={{ background: msg.color }}>{msg.avatar}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: msg.unread ? '800' : '600', fontSize: '0.9rem' }}>{msg.from}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-ink-muted)' }}>{msg.time}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)', marginTop: '0.1rem' }}>{msg.role}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--color-ink-light)', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '350px' }}>{msg.preview}</div>
                  </div>
                  {msg.unread && <div style={{ width: '8px', height: '8px', background: '#6366f1', borderRadius: '50%', flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          </div>
        );

        case 'notifications': {
          const renderNotificationIcon = (icon) => {
            switch (icon) {
              case '🎯': return <Target size={18} style={{ color: '#6366f1' }} />;
              case '📅': return <Calendar size={18} style={{ color: '#f59e0b' }} />;
              case '⭐': return <Star size={18} style={{ color: '#ec4899' }} />;
              case '✅': return <CheckCircle size={18} style={{ color: '#10b981' }} />;
              case '💼': return <Briefcase size={18} style={{ color: '#8b5cf6' }} />;
              default: return <Bell size={18} style={{ color: '#64748b' }} />;
            }
          };
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="cp-page-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Bell size={20} style={{ color: '#6366f1' }} /> Notifications</h2><p>{dummyNotifications.filter(n => n.unread).length} new notification(s).</p></div>
              <div className="cp-section-card" style={{ padding: 0, overflow: 'hidden' }}>
                {dummyNotifications.map((n, idx) => (
                  <div key={n.id} className="cp-message-row" style={{ borderBottom: idx < dummyNotifications.length - 1 ? '1px solid var(--color-border)' : 'none', background: n.unread ? 'var(--color-paper-light)' : 'transparent', cursor: 'pointer' }}
                    onClick={() => handleMarkNotificationRead(n.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'var(--color-paper-darker)', borderRadius: '8px', flexShrink: 0 }}>
                      {renderNotificationIcon(n.icon)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: n.unread ? '800' : '600', fontSize: '0.9rem' }}>{n.title}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-ink-muted)' }}>{n.time}</span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--color-ink-light)', marginTop: '0.2rem' }}>{n.body}</div>
                    </div>
                    {n.unread && <div style={{ width: '8px', height: '8px', background: '#6366f1', borderRadius: '50%', flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        case 'ai-assistant': return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
            <div className="cp-page-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Bot size={20} style={{ color: '#6366f1' }} /> AI Career Assistant</h2><p>Ask me anything about your career, resume, or job search!</p></div>
            <div className="cp-section-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
              <div className="cp-chat-messages">
                {candidateAIMessages.map((msg, idx) => (
                  <div key={idx} className={`cp-chat-bubble ${msg.sender === 'ai' ? 'cp-chat-ai' : 'cp-chat-user'}`}>
                    {msg.sender === 'ai' && <Bot size={18} style={{ color: '#6366f1', flexShrink: 0, marginTop: '0.2rem' }} />}
                    <div className="cp-chat-text">{msg.text}</div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--color-border)', padding: '1rem', display: 'flex', gap: '0.75rem' }}>
                <input type="text" className="input-text" style={{ flex: 1, margin: 0 }}
                  placeholder="Ask about resume tips, salary negotiation, interview prep..."
                  value={candidateAIInput} onChange={e => setCandidateAIInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && candidateAIInput.trim()) {
                      const userMsg = candidateAIInput.trim();
                      const nextMsgs1 = [...candidateAIMessages, { sender: 'user', text: userMsg }];
                      setCandidateAIMessages(nextMsgs1);
                      setCandidateAIInput('');
                      saveCandidateMetadata(null, null, nextMsgs1);
                      setTimeout(async () => {
                        const responses = [
                          "Great question! Based on your React and TypeScript skills, I'd recommend highlighting your component architecture experience and any performance optimization work you've done.",
                          "For salary negotiation, always research market rates first. With your profile, you could realistically ask for 25-35 LPA in Bangalore for a Senior Frontend role.",
                          "Your resume looks solid! I'd suggest adding quantified achievements — e.g., 'Reduced page load time by 40%' rather than just 'Improved performance'.",
                          "For the technical interview, practice LeetCode medium problems (arrays, hashmaps, trees) and be ready to discuss system design concepts like caching and load balancing.",
                        ];
                        const reply = responses[Math.floor(Math.random() * responses.length)];
                        const nextMsgs2 = [...nextMsgs1, { sender: 'ai', text: reply }];
                        setCandidateAIMessages(nextMsgs2);
                        await saveCandidateMetadata(null, null, nextMsgs2);
                      }, 800);
                    }
                  }} />
                <button className="cp-action-btn" style={{ width: 'auto', padding: '0.6rem 1.25rem' }}
                  onClick={async () => {
                    if (!candidateAIInput.trim()) return;
                    const userMsg = candidateAIInput.trim();
                    const nextMsgs1 = [...candidateAIMessages, { sender: 'user', text: userMsg }];
                    setCandidateAIMessages(nextMsgs1);
                    setCandidateAIInput('');
                    await saveCandidateMetadata(null, null, nextMsgs1);
                    setTimeout(async () => {
                      const nextMsgs2 = [...nextMsgs1, { sender: 'ai', text: "I'd recommend tailoring your resume to match the job description keywords. Would you like me to analyze a specific job description for you?" }];
                      setCandidateAIMessages(nextMsgs2);
                      await saveCandidateMetadata(null, null, nextMsgs2);
                    }, 800);
                  }}>Send</button>
              </div>
            </div>
          </div>
        );

        case 'ai-interview': return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="cp-page-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Target size={20} style={{ color: '#6366f1' }} /> AI Interview Preparation</h2><p>Practice interview questions tailored to your applied roles.</p></div>
            <div className="cp-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {[{ label: 'Topics', value: interviewPrepTopics.length, icon: <BookOpen size={18} />, color: '#6366f1' }, { label: 'Questions Practiced', value: 47, icon: <ClipboardList size={18} />, color: '#8b5cf6' }, { label: 'Average Score', value: '76%', icon: <Award size={18} />, color: '#10b981' }].map(s => (
                <div key={s.label} className="cp-stat-card">
                  <div className="cp-stat-icon" style={{ background: s.color + '20', color: s.color }}>{s.icon}</div>
                  <div className="cp-stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="cp-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
            {interviewPrepTopics.map(topic => (
              <div key={topic.id} className="cp-section-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '1rem' }}>{topic.topic}</div>
                    <div className="cp-app-date">{topic.questions} questions · <span style={{ color: topic.difficulty === 'Advanced' ? '#ef4444' : topic.difficulty === 'Intermediate' ? '#f59e0b' : '#10b981' }}>{topic.difficulty}</span></div>
                  </div>
                  <button className="cp-action-btn" style={{ fontSize: '0.78rem', padding: '0.4rem 1rem' }} onClick={() => { setActivePracticeTopic(topic); setPracticeAnswer(''); setPracticeFeedback(null); }}>Practice Now</button>
                </div>
                <div className="cp-progress-bar-track">
                  <div className="cp-progress-bar-fill" style={{ width: `${topic.progress}%`, background: topic.progress > 70 ? '#10b981' : topic.progress > 40 ? '#f59e0b' : '#6366f1' }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-ink-muted)', marginTop: '0.35rem' }}>{topic.progress}% complete</div>
              </div>
            ))}
          </div>
        );

        case 'settings': return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="cp-page-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Settings size={20} style={{ color: '#6366f1' }} /> Settings</h2><p>Manage your account and notification preferences.</p></div>
            <div className="cp-section-card">
              <div className="cp-section-header"><span>Account</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div><div style={{ fontWeight: '700' }}>Email Address</div><div className="cp-app-date">{session.user.email}</div></div>
                  <button className="cp-action-btn-sm" onClick={() => alert('Email cannot be changed here. Contact support.')}>Change</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div><div style={{ fontWeight: '700' }}>Password</div><div className="cp-app-date">Last changed: Never</div></div>
                  <button className="cp-action-btn-sm" onClick={() => alert('Password reset link sent to your email.')}>Reset</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div><div style={{ fontWeight: '700' }}>Profile Visibility</div><div className="cp-app-date">{settingsPreferences.visibility} — Visible to {settingsPreferences.visibility === 'Public' ? 'all recruiters' : 'none'}</div></div>
                  <button className="cp-action-btn-sm" onClick={() => {
                    const nextVis = settingsPreferences.visibility === 'Public' ? 'Private' : 'Public';
                    setSettingsPreferences(p => ({ ...p, visibility: nextVis }));
                    alert(`Visibility updated to ${nextVis}!`);
                  }}>Toggle</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0' }}>
                  <div><div style={{ fontWeight: '700', color: '#ef4444' }}>Delete Account</div><div className="cp-app-date">Permanently delete your account and all data</div></div>
                  <button className="cp-action-btn-sm" style={{ background: '#ef444420', color: '#ef4444' }} onClick={() => alert('Please contact support to delete your account.')}>Delete</button>
                </div>
              </div>
            </div>
            <div className="cp-section-card">
              <div className="cp-section-header"><span>Notifications</span></div>
              {[
                { label: 'Email Notifications', sub: 'Receive updates via email', key: 'emailNotifications' },
                { label: 'Application Status Updates', sub: 'When your stage changes', key: 'statusUpdates' },
                { label: 'Interview Reminders', sub: '24 hours before your interview', key: 'reminders' },
                { label: 'Job Recommendations', sub: 'Weekly curated job matches', key: 'recommendations' },
              ].map(setting => {
                const isOn = settingsPreferences[setting.key];
                return (
                  <div key={setting.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)' }}>
                    <div><div style={{ fontWeight: '700', fontSize: '0.88rem' }}>{setting.label}</div><div className="cp-app-date">{setting.sub}</div></div>
                    <div className={`cp-toggle ${isOn ? 'active' : ''}`} style={{ background: isOn ? '#6366f1' : 'var(--color-border)' }}
                      onClick={() => setSettingsPreferences(p => ({ ...p, [setting.key]: !p[setting.key] }))} />
                  </div>
                );
              })}
            </div>
          </div>
        );

        default: return null;
      }
    };

    return (
      <div className="cp-container">
        {/* Sidebar */}
        <aside className="cp-sidebar">
          <div className="cp-sidebar-brand">
            <Target size={20} />
            <span>RecruiterPro</span>
          </div>
          <nav className="cp-sidebar-nav">
            {navItems.map(item => (
              <button
                key={item.id}
                type="button"
                className={`cp-nav-item ${activeCandidateNavTab === item.id || (activeCandidateNavTab === 'apply' && item.id === 'jobs') ? 'cp-nav-active' : ''}`}
                onClick={() => {
                  if (item.id === 'jobs' && selectedJobForApplication) setSelectedJobForApplication(null);
                  setActiveCandidateNavTab(item.id);
                }}
              >
                <span className="cp-nav-icon">{item.icon}</span>
                <span className="cp-nav-label">{item.label}</span>
                {item.badge > 0 && <span className="cp-nav-badge">{item.badge}</span>}
              </button>
            ))}
            <div className="cp-sidebar-divider" />
            <button type="button" className="cp-nav-item cp-nav-logout" onClick={handleLogout}>
              <LogOut size={16} />
              <span className="cp-nav-label">Logout</span>
            </button>
          </nav>
          <div className="cp-sidebar-user">
            <div className="cp-sidebar-avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {candidateProfileData.avatarUrl ? (
                <img src={candidateProfileData.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                displayName.charAt(0)
              )}
            </div>
            <div className="cp-sidebar-user-info">
              <div className="cp-sidebar-name">{displayName}</div>
              <div className="cp-sidebar-email">{session.user.email}</div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="cp-main">
          <div className="cp-main-inner scroll-container">
            {selectedJobForApplication && activeCandidateNavTab !== 'apply'
              ? null
              : renderPortalContent()
            }
            {!selectedJobForApplication && activeCandidateNavTab === 'apply' && (
              <div className="cp-page-header"><p>Select a job to apply from Job Search.</p></div>
            )}
          </div>
        </main>

        {/* Offer Review Modal */}
        {activeOfferCandidateId && (() => {
          const cand = candidates.find(c => c.id === activeOfferCandidateId);
          if (!cand) return null;
          const activeJobIds = Object.keys(cand.jobsData || {});
          const jId = activeJobIds[0] || 'job-1';
          const activeJob = jobs.find(j => j.id === jId) || jobs[0];
          return (
            <div className="modal-backdrop">
              <div className="modal-content" style={{ width: '760px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="modal-title" style={{ color: 'var(--color-gold)' }}>Review Job Offer</h3>
                  <button type="button" className="btn-close" style={{ border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => setActiveOfferCandidateId(null)}><X size={20} /></button>
                </div>
                <div className="offer-letter-card">
                  <div className="offer-letter-header">
                    <span className="offer-letter-brand">RecruiterPro Corp</span>
                    <span className="offer-letter-date">DATE: {new Date().toLocaleDateString()}</span>
                  </div>
                  <div>
                    <p>Dear <strong>{cand.name}</strong>,</p>
                    <p>We are delighted to extend a formal offer for the position of <strong>{activeJob.title}</strong>. Your ATS match score of <strong>{cand.score}%</strong> stood out remarkably.</p>
                    <p>Your package and start details:</p>
                    <div className="offer-salary-highlight">Annual CTC: {offerSalaryLpa} LPA</div>
                    <p>Target joining date: <strong>{offerJoiningDate}</strong></p>
                    {offerNotes && <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}><strong>Perks & Conditions:</strong><p style={{ margin: '0.25rem 0', fontStyle: 'italic' }}>{offerNotes}</p></div>}
                    <p style={{ marginTop: '1rem' }}>To accept, check the box and type your legal name below.</p>
                    <div className="signature-block">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input type="checkbox" id="offer-check" checked={isOfferSigned} onChange={e => setIsOfferSigned(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                        <label htmlFor="offer-check" style={{ fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>I accept all employment terms and conditions.</label>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
                        <span className="signature-input-label">Digital Signature (Type Legal Name)</span>
                        <input type="text" className="signature-input-field" placeholder="e.g. Jane Miller" value={candidateSignature} onChange={e => setCandidateSignature(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="button" className="btn-secondary" onClick={() => setActiveOfferCandidateId(null)}>Close</button>
                  <button type="button" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 2rem', backgroundColor: 'var(--color-sage)', border: 'none', color: '#FFF', cursor: 'pointer' }}
                    disabled={!isOfferSigned || !candidateSignature.trim()}
                    onClick={() => {
                      const timeStr = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const updatedLog = [...(cand.activityLog || [])];
                      updatedLog.push({ id: updatedLog.length + 1, type: 'hired', text: `🎉 Offer accepted and signed: "${candidateSignature}"`, timestamp: timeStr });
                      updateCandidateJobData(cand.id, { stage: 'hired', offerSignature: { signature: candidateSignature, signedAt: timeStr }, activityLog: updatedLog });
                      setIsOfferSigned(false); setCandidateSignature(''); setActiveOfferCandidateId(null);
                      alert('🎉 Congratulations! You have accepted the offer. Welcome aboard!');
                    }}>
                    Accept & Sign Offer
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Interactive Quiz Modal */}
        {activeAssessmentQuiz && (() => {
          const questions = QUIZ_QUESTIONS[activeAssessmentQuiz.id] || [];
          return (
            <div className="modal-backdrop" style={{ zIndex: 10002 }}>
              <div className="modal-content" style={{ width: '600px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6366f1' }}>
                    <Award size={20} /> {activeAssessmentQuiz.title}
                  </h3>
                  <button type="button" className="btn-close" style={{ border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => { setActiveAssessmentQuiz(null); setQuizAnswers({}); }}><X size={20} /></button>
                </div>
                <div style={{ color: 'var(--color-ink-muted)', fontSize: '0.85rem' }}>
                  Duration: {activeAssessmentQuiz.duration} · {questions.length} Questions · Pass mark: 70%
                </div>
                
                {questions.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#ef4444' }}>No questions available for this quiz.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '0.5rem' }}>
                    {questions.map((item, qIdx) => {
                      const selectedVal = quizAnswers[qIdx];
                      return (
                        <div key={qIdx} style={{ background: 'var(--color-paper-light)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1rem' }}>
                          <div style={{ fontWeight: '800', fontSize: '0.92rem', marginBottom: '0.75rem', color: 'var(--color-ink)' }}>
                            {qIdx + 1}. {item.q}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {item.options.map((opt, oIdx) => (
                              <label key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', padding: '0.35rem 0.5rem', borderRadius: '4px', background: selectedVal === oIdx ? 'rgba(99,102,241,0.08)' : 'transparent', border: selectedVal === oIdx ? '1px solid #6366f1' : '1px solid transparent' }}>
                                <input type="radio" name={`quiz-q-${qIdx}`} checked={selectedVal === oIdx} onChange={() => setQuizAnswers(prev => ({ ...prev, [qIdx]: oIdx }))} style={{ cursor: 'pointer' }} />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="button" className="btn-secondary" onClick={() => { setActiveAssessmentQuiz(null); setQuizAnswers({}); }}>Cancel</button>
                  <button type="button" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 2rem', backgroundColor: '#6366f1', border: 'none', color: '#FFF', cursor: 'pointer' }}
                    disabled={questions.length > 0 && Object.keys(quizAnswers).length < questions.length}
                    onClick={() => {
                      let correct = 0;
                      questions.forEach((item, qIdx) => {
                        if (quizAnswers[qIdx] === item.answer) {
                          correct++;
                        }
                      });
                      const scoreVal = Math.round((correct / questions.length) * 100);
                      
                      // Update assessment state
                      setCandidateAssessments(prev => prev.map(a => a.id === activeAssessmentQuiz.id ? { ...a, status: 'completed', score: scoreVal } : a));
                      
                      // Add notification
                      const timeStr = 'Just now';
                      const newNotification = {
                        id: Math.random(),
                        icon: '✅',
                        title: 'Assessment Completed',
                        body: `You completed the ${activeAssessmentQuiz.title} assessment with a score of ${scoreVal}/100.`,
                        time: timeStr,
                        unread: true
                      };
                      setCandidateNotifications(prev => [newNotification, ...prev]);
                      
                      // Alert
                      alert(`Assessment submitted successfully! Score: ${scoreVal}% (${correct}/${questions.length} correct)`);
                      
                      // Clear
                      setActiveAssessmentQuiz(null);
                      setQuizAnswers({});
                    }}>
                    Submit Assessment
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* AI Practice Prep Modal */}
        {activePracticeTopic && (() => {
          const practiceQuestions = {
            1: "Explain the difference between functional components and class components in React, and how the React fiber architecture or reconciliation works.",
            2: "How would you design a scalable notification service that can handle millions of push notifications per day with low latency?",
            3: "What is the event loop in JavaScript, and what is the difference between interface and type in TypeScript?",
            4: "Describe a conflict you had with a team member, how you resolved it, and what you learned from the experience."
          };
          const questionText = practiceQuestions[activePracticeTopic.id] || "Explain the concept of responsive web design, layout performance optimization, and custom CSS variables.";
          
          return (
            <div className="modal-backdrop" style={{ zIndex: 10002 }}>
              <div className="modal-content" style={{ width: '640px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#8b5cf6' }}>
                    <Target size={20} /> Prep with AI: {activePracticeTopic.topic}
                  </h3>
                  <button type="button" className="btn-close" style={{ border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => { setActivePracticeTopic(null); setPracticeAnswer(''); setPracticeFeedback(null); }}><X size={20} /></button>
                </div>
                <div style={{ color: 'var(--color-ink-muted)', fontSize: '0.85rem' }}>
                  Difficulty: {activePracticeTopic.difficulty} · Simulating Real-time AI Evaluation
                </div>
                
                <div style={{ background: 'var(--color-paper-light)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1rem', marginTop: '0.5rem' }}>
                  <div style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--color-ink-light)', marginBottom: '0.5rem' }}>Practice Question:</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--color-ink)', lineHeight: 1.5 }}>
                    {questionText}
                  </div>
                </div>

                {!practiceFeedback ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label text-xs">Your Answer</label>
                      <textarea className="input-textarea" style={{ minHeight: '160px', fontSize: '0.88rem' }}
                        placeholder="Type your structured answer here (include key concepts, architectural terms, or behavioral techniques)..."
                        value={practiceAnswer} onChange={e => setPracticeAnswer(e.target.value)} disabled={practiceLoading} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn-secondary" onClick={() => { setActivePracticeTopic(null); setPracticeAnswer(''); }} disabled={practiceLoading}>Cancel</button>
                      <button type="button" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 2rem', backgroundColor: '#8b5cf6', border: 'none', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        disabled={!practiceAnswer.trim() || practiceLoading}
                        onClick={() => {
                          setPracticeLoading(true);
                          setTimeout(() => {
                            setPracticeLoading(false);
                            // Evaluate answer based on keywords
                            const answerLower = practiceAnswer.toLowerCase();
                            let score = 65;
                            const strengths = [];
                            const improvements = [];
                            
                            if (activePracticeTopic.id === 1) { // React
                              const kw = ['state', 'props', 'hook', 'fiber', 'reconciliation', 'dom', 'render', 'lifecycle', 'virtual dom', 'functional', 'class', 'concurrent'];
                              let matches = 0;
                              kw.forEach(w => { if (answerLower.includes(w)) matches++; });
                              score += Math.min(matches * 3, 30);
                              
                              if (answerLower.includes('fiber') || answerLower.includes('reconciliation')) {
                                strengths.push("Strong explanation of the React Fiber architecture and the reconciliation engine.");
                              } else {
                                improvements.push("Consider mentioning Fiber, scheduling, and the diffing algorithm (reconciliation).");
                              }
                              if (answerLower.includes('hook') || answerLower.includes('state')) {
                                strengths.push("Demonstrated understanding of state management and dynamic React hooks.");
                              } else {
                                improvements.push("Mention functional hooks (useState, useEffect) and how they preserve state between renders.");
                              }
                            } else if (activePracticeTopic.id === 2) { // System Design
                              const kw = ['cache', 'queue', 'scale', 'database', 'latency', 'redis', 'kafka', 'pub/sub', 'rabbitmq', 'microservices', 'load balancer', 'cdn', 'rate limit'];
                              let matches = 0;
                              kw.forEach(w => { if (answerLower.includes(w)) matches++; });
                              score += Math.min(matches * 3, 30);
                              
                              if (answerLower.includes('queue') || answerLower.includes('kafka') || answerLower.includes('pub') || answerLower.includes('rabbitmq')) {
                                strengths.push("Correctly leveraged message brokers (e.g. Kafka, RabbitMQ) to decouple notification triggers.");
                              } else {
                                improvements.push("Add a message queue or pub/sub layer to handle high load peaks asynchronously.");
                              }
                              if (answerLower.includes('cache') || answerLower.includes('redis')) {
                                strengths.push("Good inclusion of in-memory caching (Redis) for rapid template and user preference access.");
                              } else {
                                improvements.push("Utilize caching mechanisms to prevent database bottlenecks during massive spikes.");
                              }
                            } else if (activePracticeTopic.id === 3) { // JS / TS
                              const kw = ['event loop', 'call stack', 'callback', 'promise', 'async', 'interface', 'type', 'union', 'extend', 'prototype', 'microtask', 'macrotask'];
                              let matches = 0;
                              kw.forEach(w => { if (answerLower.includes(w)) matches++; });
                              score += Math.min(matches * 3, 30);
                              
                              if (answerLower.includes('event loop') || answerLower.includes('stack') || answerLower.includes('queue')) {
                                strengths.push("Clear description of call stack execution and the task queuing mechanism.");
                              } else {
                                improvements.push("Detail how the event loop checks the call stack and dequeues callback tasks.");
                              }
                              if (answerLower.includes('interface') && answerLower.includes('type')) {
                                strengths.push("Understood key TS differences (e.g. declaration merging in interfaces vs union types).");
                              } else {
                                improvements.push("Highlight that interfaces support declaration merging, whereas types can represent unions and intersections.");
                              }
                            } else { // Behavioral / HR or fallback
                              const kw = ['star', 'situation', 'task', 'action', 'result', 'communicate', 'resolve', 'feedback', 'team', 'listen', 'collaborate', 'lead'];
                              let matches = 0;
                              kw.forEach(w => { if (answerLower.includes(w)) matches++; });
                              score += Math.min(matches * 3, 30);
                              
                              if (answerLower.includes('result') || answerLower.includes('action')) {
                                strengths.push("Structured narrative using action-oriented steps and clear final results.");
                              } else {
                                improvements.push("Use the STAR framework (Situation, Task, Action, Result) to format your answers.");
                              }
                              if (answerLower.includes('communicate') || answerLower.includes('listen') || answerLower.includes('resolve')) {
                                strengths.push("Emphasized collaborative communication and constructive resolution paths.");
                              }
                            }
                            
                            if (strengths.length === 0) strengths.push("Completed response with general domain knowledge.");
                            if (improvements.length === 0) improvements.push("Elaborate further with specific architectural or design patterns to stand out.");

                            setPracticeFeedback({
                              score,
                              strengths,
                              improvements
                            });
                          }, 1200);
                        }}>
                        {practiceLoading ? 'Evaluating with AI...' : 'Submit Answer for Review'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.25s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-paper-light)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#8b5cf620', color: '#8b5cf6', width: '60px', height: '60px', borderRadius: '30px', fontSize: '1.25rem', fontWeight: '800', flexShrink: 0 }}>
                        {practiceFeedback.score}%
                      </div>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--color-ink)' }}>AI Evaluation Complete</div>
                        <div className="cp-app-date">Score based on depth of content, terminology, and structure.</div>
                      </div>
                    </div>
                    
                    <div style={{ background: '#10b98110', border: '1px solid #10b98130', borderRadius: '8px', padding: '1rem' }}>
                      <div style={{ fontWeight: '800', color: '#10b981', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Key Strengths</div>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--color-ink-light)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {practiceFeedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>

                    <div style={{ background: '#f59e0b10', border: '1px solid #f59e0b30', borderRadius: '8px', padding: '1rem' }}>
                      <div style={{ fontWeight: '800', color: '#f59e0b', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Areas of Improvement</div>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--color-ink-light)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {practiceFeedback.improvements.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <button className="btn-secondary" onClick={() => setPracticeFeedback(null)}>Practice Again</button>
                      <button className="cp-action-btn" style={{ width: 'auto', padding: '0.5rem 1.5rem', background: '#8b5cf6' }} onClick={() => { setActivePracticeTopic(null); setPracticeAnswer(''); setPracticeFeedback(null); }}>Complete Topic</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Messages Chat Dialog Modal */}
        {activeChatMsg && (
          <div className="modal-backdrop" style={{ zIndex: 10002 }}>
            <div className="modal-content" style={{ width: '560px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '90vh' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="cp-msg-avatar" style={{ background: activeChatMsg.color, width: '40px', height: '40px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontWeight: 'bold' }}>
                    {activeChatMsg.avatar}
                  </div>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--color-ink)' }}>{activeChatMsg.from}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>{activeChatMsg.role}</div>
                  </div>
                </div>
                <button type="button" className="btn-close" style={{ border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => setActiveChatMsg(null)}><X size={20} /></button>
              </div>

              <div className="cp-chat-messages" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1, padding: '0.5rem 0' }}>
                {activeChatMsg.chatHistory && activeChatMsg.chatHistory.map((m, idx) => {
                  const isUser = m.sender === 'user';
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', margin: '0.2rem 0' }}>
                      <div style={{
                        maxWidth: '75%',
                        padding: '0.65rem 0.95rem',
                        fontSize: '0.85rem',
                        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isUser ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'var(--color-paper-light)',
                        color: isUser ? '#fff' : 'var(--color-ink)',
                        border: isUser ? 'none' : '1px solid var(--color-border)',
                        lineHeight: 1.4
                      }}>
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
                <input type="text" className="input-text" style={{ flex: 1, margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                  placeholder="Type a message..."
                  value={newMessageText}
                  onChange={e => setNewMessageText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newMessageText.trim()) {
                      const userTxt = newMessageText.trim();
                      const nextHist = [...(activeChatMsg.chatHistory || []), { sender: 'user', text: userTxt }];
                      
                      // Update modal active message state
                      setActiveChatMsg(prev => ({ ...prev, chatHistory: nextHist, preview: userTxt }));
                      // Update central state
                      setCandidateMessages(prev => prev.map(msg => msg.id === activeChatMsg.id ? { ...msg, chatHistory: nextHist, preview: userTxt } : msg));
                      setNewMessageText('');
                      
                      // Auto response trigger
                      setTimeout(() => {
                        const autoReplies = {
                          1: ["Thanks for the update! I have scheduled your interview for Friday at 3:00 PM.", "Perfect, I will confirm with the hiring manager and get back to you."],
                          2: ["That makes sense. Can you also talk about how you manage shared state across micro-frontends?", "Great. We will send you an invite for the Zoom meeting shortly."],
                          3: ["Thanks for reaching out! We are currently finalizing the schedules and will let you know by next week."],
                          4: ["This is an automated system broadcast. Please check your notifications for updates."]
                        };
                        const replies = autoReplies[activeChatMsg.id] || ["Thanks for your response. We will get back to you soon!"];
                        const autoReplyText = replies[Math.floor(Math.random() * replies.length)];
                        
                        setCandidateMessages(prev => prev.map(msg => {
                          if (msg.id === activeChatMsg.id) {
                            return { ...msg, chatHistory: [...msg.chatHistory, { sender: 'them', text: autoReplyText }], preview: autoReplyText };
                          }
                          return msg;
                        }));
                        setActiveChatMsg(prev => {
                          if (prev && prev.id === activeChatMsg.id) {
                            return { ...prev, chatHistory: [...(prev.chatHistory || []), { sender: 'them', text: autoReplyText }], preview: autoReplyText };
                          }
                          return prev;
                        });
                      }, 1500);
                    }
                  }} />
                <button className="cp-action-btn" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  disabled={!newMessageText.trim()}
                  onClick={() => {
                    const userTxt = newMessageText.trim();
                    const nextHist = [...(activeChatMsg.chatHistory || []), { sender: 'user', text: userTxt }];
                    
                    setActiveChatMsg(prev => ({ ...prev, chatHistory: nextHist, preview: userTxt }));
                    setCandidateMessages(prev => prev.map(msg => msg.id === activeChatMsg.id ? { ...msg, chatHistory: nextHist, preview: userTxt } : msg));
                    setNewMessageText('');
                    
                    setTimeout(() => {
                      const autoReplies = {
                        1: ["Thanks for the update! I have scheduled your interview for Friday at 3:00 PM.", "Perfect, I will confirm with the hiring manager and get back to you."],
                        2: ["That makes sense. Can you also talk about how you manage shared state across micro-frontends?", "Great. We will send you an invite for the Zoom meeting shortly."],
                        3: ["Thanks for reaching out! We are currently finalizing the schedules and will let you know by next week."],
                        4: ["This is an automated system broadcast. Please check your notifications for updates."]
                      };
                      const replies = autoReplies[activeChatMsg.id] || ["Thanks for your response. We will get back to you soon!"];
                      const autoReplyText = replies[Math.floor(Math.random() * replies.length)];
                      
                      setCandidateMessages(prev => prev.map(msg => {
                        if (msg.id === activeChatMsg.id) {
                          return { ...msg, chatHistory: [...msg.chatHistory, { sender: 'them', text: autoReplyText }], preview: autoReplyText };
                        }
                        return msg;
                      }));
                      setActiveChatMsg(prev => {
                        if (prev && prev.id === activeChatMsg.id) {
                          return { ...prev, chatHistory: [...(prev.chatHistory || []), { sender: 'them', text: autoReplyText }], preview: autoReplyText };
                        }
                        return prev;
                      });
                    }, 1500);
                  }}>
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  const renderCandidateAuthModal = () => {
    if (!isCandidateAuthOpen) return null;
    return (
      <div className="modal-backdrop" style={{ zIndex: 10001 }}>
        <div className="modal-content candidate-auth-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="modal-title" style={{ fontSize: '1.2rem', color: 'var(--color-terracotta)', fontWeight: '850' }}>
              {candidateAuthMode === 'login' ? 'Candidate Sign In' : 'Candidate Account Sign Up'}
            </h3>
            <button 
              type="button" 
              className="btn-close" 
              style={{ border: 'none', background: 'none', cursor: 'pointer' }}
              onClick={() => {
                setIsCandidateAuthOpen(false);
                setCandidateAuthError(null);
              }}
            >
              <X size={18} />
            </button>
          </div>

          {candidateAuthError && (
            <div className="auth-error-banner" style={{ marginBottom: 0 }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{candidateAuthError}</span>
            </div>
          )}

          <form onSubmit={handleCandidateAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label text-xs">Email Address</label>
              <input
                type="email"
                className="input-text"
                placeholder="you@example.com"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                disabled={candidateAuthLoading}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label text-xs">Password</label>
              <input
                type="password"
                className="input-text"
                placeholder="••••••••"
                value={candidatePassword}
                onChange={(e) => setCandidatePassword(e.target.value)}
                disabled={candidateAuthLoading}
                required
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '0.65rem', backgroundColor: 'var(--color-terracotta)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
              disabled={candidateAuthLoading}
            >
              {candidateAuthLoading ? (
                <>
                  <RefreshCw className="spinner" size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
                  <span>Loading...</span>
                </>
              ) : (
                <span>{candidateAuthMode === 'login' ? 'Sign In' : 'Sign Up & Create Account'}</span>
              )}
            </button>
          </form>

          <div style={{ fontSize: '0.8rem', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
            {candidateAuthMode === 'login' ? (
              <>
                New to RecruiterPro?{' '}
                <button
                  type="button"
                  className="auth-mode-switch-btn"
                  onClick={() => {
                    setCandidateAuthMode('register');
                    setCandidateAuthError(null);
                  }}
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have a profile?{' '}
                <button
                  type="button"
                  className="auth-mode-switch-btn"
                  onClick={() => {
                    setCandidateAuthMode('login');
                    setCandidateAuthError(null);
                  }}
                >
                  Sign in here
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderLoginScreen = () => {
    const isCandidate = loginRole === 'candidate';
    const isRegister = loginMode === 'register';

    return (
      <div className="auth-container">
        {/* Background Glowing Blobs */}
        <div className="auth-bg-blob blob-1"></div>
        <div className="auth-bg-blob blob-2"></div>
        <div className="auth-bg-blob blob-3"></div>

        <div className="auth-card" style={{ maxWidth: '440px' }}>
          <div className="auth-header">
            <div className="auth-logo-circle">
              <Sparkles size={26} />
            </div>
            <h2 className="auth-title">RecruiterPro</h2>
            <p className="auth-subtitle">AI-Powered Hiring Platform</p>
          </div>

          {/* Role Selector Tabs */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="auth-label" style={{ marginBottom: '0.6rem', display: 'block', textAlign: 'center' }}>Portal Login</label>
            <div className="auth-role-tabs">
              <button
                type="button"
                className={`auth-role-tab ${isCandidate ? 'active' : ''}`}
                onClick={() => {
                  setLoginRole('candidate');
                  setLoginMode('login');
                  setLoginError(null);
                  setLoginEmail('');
                  setLoginPassword('');
                }}
                disabled={isSigningIn}
              >
                <Users size={16} />
                <span>Job Candidate</span>
              </button>
              <button
                type="button"
                className={`auth-role-tab ${!isCandidate ? 'active' : ''}`}
                onClick={() => {
                  setLoginRole('admin');
                  setLoginMode('login');
                  setLoginError(null);
                  setLoginEmail('');
                  setLoginPassword('');
                }}
                disabled={isSigningIn}
              >
                <Briefcase size={16} />
                <span>HR Recruiter</span>
              </button>
            </div>
          </div>

          {/* Login / Register Tabs (Always Available) */}
          <div className="auth-mode-tabs">
            <button
              type="button"
              className={`auth-mode-tab ${loginMode === 'login' ? 'active' : ''}`}
              onClick={() => { setLoginMode('login'); setLoginError(null); }}
              disabled={isSigningIn}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-mode-tab ${loginMode === 'register' ? 'active' : ''}`}
              onClick={() => { setLoginMode('register'); setLoginError(null); }}
              disabled={isSigningIn}
            >
              Create Account
            </button>
          </div>

          {loginError && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <div className="auth-error-banner" style={{ marginBottom: 0 }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{loginError}</span>
              </div>
              <div style={{ 
                padding: '0.75rem', 
                background: 'rgba(239, 68, 68, 0.05)', 
                border: '1px solid rgba(239, 68, 68, 0.15)', 
                borderRadius: '6px', 
                fontSize: '0.72rem', 
                color: 'var(--color-ink-muted)',
                textAlign: 'left'
              }}>
                <strong style={{ color: '#ef4444', display: 'block', marginBottom: '0.25rem' }}>Troubleshooting Tips:</strong>
                <ul style={{ paddingLeft: '1.1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <li>Make sure you have selected the correct tab above (<strong>Job Candidate</strong> or <strong>HR Recruiter</strong>).</li>
                  <li>Verify that your email and password are correct.</li>
                  <li>If this is a new account, check your email inbox (including spam) for a verification link to confirm your email.</li>
                  <li>HR Recruiter accounts must be registered with the recruiter role.</li>
                </ul>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="auth-form">
            <div className="auth-form-group">
              <label className="auth-label" htmlFor="email-input">Email Address</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon"><Mail size={16} /></span>
                <input
                  id="email-input"
                  type="email"
                  className="auth-input"
                  placeholder={isCandidate ? 'you@example.com' : 'recruiter@example.com'}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={isSigningIn}
                  required
                />
              </div>
            </div>

            <div className="auth-form-group">
              <label className="auth-label" htmlFor="password-input">
                Password{isRegister && <span style={{ fontWeight: 400, color: 'var(--color-ink-muted)', fontSize: '0.72rem' }}> (min 6 characters)</span>}
              </label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon"><Lock size={16} /></span>
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={isSigningIn}
                  required
                />
                <button
                  type="button"
                  className="auth-input-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-btn-submit"
              disabled={isSigningIn}
            >
              {isSigningIn ? (
                <>
                  <RefreshCw className="spinner" size={16} style={{ animation: 'spin 1.5s linear infinite' }} />
                  <span>{isRegister ? 'Creating Account...' : 'Signing In...'}</span>
                </>
              ) : (
                <span>{isRegister ? (isCandidate ? '🚀 Create Candidate Account' : '🏢 Create Recruiter Account') : isCandidate ? '🔑 Sign In to Candidate Portal' : '🏢 Recruiter Sign In'}</span>
              )}
            </button>
          </form>

          {!isCandidate && loginMode === 'login' && (
            <div style={{ marginTop: '1.25rem', padding: '0.75rem', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--color-ink-muted)', textAlign: 'center' }}>
              <strong style={{ color: 'var(--color-ink-light)' }}>Authorized Access Only</strong><br />Please sign in using your recruiter coordinates.
            </div>
          )}

          <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>
            {loginMode === 'login' ? (
              <>Don't have an account?{' '}
                <button type="button" onClick={() => setLoginMode('register')} style={{ background: 'none', border: 'none', color: '#8b5cf6', fontWeight: '700', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline' }}>Create one free →</button>
              </>
            ) : (
              <>Already registered?{' '}
                <button type="button" onClick={() => setLoginMode('login')} style={{ background: 'none', border: 'none', color: '#8b5cf6', fontWeight: '700', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline' }}>Sign in instead →</button>
              </>
            )}
          </div>

          {/* Database Connectivity Indicator */}
          <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--color-ink-muted)' }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: supabaseStatus === 'connected' ? '#10b981' : supabaseStatus === 'schema_missing' ? '#f59e0b' : '#ef4444', 
              display: 'inline-block' 
            }} />
            <span>Supabase Database: </span>
            <strong style={{ 
              color: supabaseStatus === 'connected' ? 'var(--color-sage)' : supabaseStatus === 'schema_missing' ? '#f59e0b' : '#ef4444' 
            }}>
              {supabaseStatus === 'connected' ? 'Connected' : supabaseStatus === 'schema_missing' ? 'Tables Missing' : supabaseStatus === 'connecting' ? 'Connecting...' : 'Connection Error'}
            </strong>
          </div>

          {/* Offline Demo Mode Bypass */}
          {supabaseStatus !== 'connected' && (
            <button
              type="button"
              className="auth-btn-submit"
              style={{
                marginTop: '0.75rem',
                fontSize: '0.75rem',
                padding: '0.45rem',
                borderRadius: '6px',
                border: '1px dashed var(--color-border)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--color-ink-light)',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                width: '100%'
              }}
              onClick={() => {
                setSupabaseStatus('offline');
                setSession({
                  user: {
                    id: 'offline-demo-id',
                    email: loginRole === 'admin' ? 'admink338@gmail.com' : 'software3369@gmail.com',
                    user_metadata: {
                      role: loginRole,
                      candidateProfileData: {
                        fullName: loginRole === 'admin' ? 'Admin Recruiter' : 'Rohan Mehta',
                        phone: '1234567890',
                        location: 'Bangalore',
                        headline: 'Lead Software Engineer',
                        skills: 'React, TypeScript, Redux',
                        education: 'BTech CS',
                        experience: '5 Years',
                        bio: 'Offline fallback demo user.',
                        avatarUrl: ''
                      }
                    }
                  }
                });
                setLoginError(null);
              }}
            >
              🚀 Enter Offline Demo Mode
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderLeftSidebar = () => {
    return (
      <aside className="recruiterpro-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo"><Target size={22} /></div>
          <div className="brand-name">RecruiterPro</div>
        </div>
        
        <nav className="sidebar-nav">
          {[
            { id: 'jobs', label: 'Jobs Dashboard', icon: <Briefcase size={18} /> },
            { id: 'candidates', label: 'Candidates Manager', icon: <Users size={18} /> },
            { id: 'linkedin', label: 'LinkedIn Portal', icon: <Linkedin size={18} /> },
            { id: 'careers', label: 'Careers Portal', icon: <Globe size={18} /> },
            { id: 'templates', label: 'Email Center', icon: <Mail size={18} /> },
            { id: 'settings', label: 'System Settings', icon: <Settings size={18} /> }
          ].map(item => {
            const isActive = activeSidebarTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveSidebarTab(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.id === 'candidates' && candidates.length > 0 && (
                  <span className="nav-badge">{candidates.length}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-avatar" title={session?.user?.email || 'Admin Recruiter'}>
            {(session?.user?.email || 'AD').substring(0, 2).toUpperCase()}
          </div>
          <div className="user-info" style={{ overflow: 'hidden' }}>
            <div className="user-name" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {session?.user?.email ? session.user.email.split('@')[0] : 'Admin Recruiter'}
            </div>
            <div className="user-role" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={userRole === 'admin' ? 'HR Recruiter' : 'Job Candidate'}>
              {userRole === 'admin' ? 'HR Recruiter' : 'Job Candidate'}
            </div>
          </div>
          <button 
            type="button" 
            className="sidebar-logout-btn" 
            onClick={handleLogout} 
            title="Log Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    );
  };

  const renderTopHeader = () => {
    let title = "Candidates Manager";
    if (activeSidebarTab === 'jobs') title = "Jobs Dashboard";
    else if (activeSidebarTab === 'linkedin') title = "LinkedIn Portal";
    else if (activeSidebarTab === 'careers') title = "Careers Page Builder";
    else if (activeSidebarTab === 'templates') title = "Email Templates & Logs";
    else if (activeSidebarTab === 'settings') title = "System Settings & Integrations";

    return (
      <header className="recruiterpro-header">
        <div className="header-breadcrumbs">
          <span className="breadcrumb-root">Dashboard</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{title}</span>
          {activeJobId && (
            <>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-job-title">{jobTitle}</span>
            </>
          )}
        </div>

        <div className="header-actions">
          {/* Supabase status pill */}
          <div 
            className={`supabase-status-pill ${supabaseStatus}`}
            onClick={() => setIsSupabaseModalOpen(true)}
            title="Click to manage Supabase database integration"
          >
            <span className="status-dot"></span>
            <span className="status-text">
              Supabase: {supabaseStatus === 'connected' ? 'Connected' : supabaseStatus === 'schema_missing' ? 'Tables Missing' : supabaseStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>

          {/* AI Assistant Chatbot toggle */}
          <button
            type="button"
            className={`theme-toggle-button ${isChatbotOpen ? 'active' : ''}`}
            onClick={() => setIsChatbotOpen(!isChatbotOpen)}
            title="Open AI Recruiting Assistant"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: isChatbotOpen ? 'var(--color-terracotta)' : 'inherit', cursor: 'pointer' }}
          >
            <Sparkles size={16} />
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>AI Ask</span>
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            className="theme-toggle-button"
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </header>
    );
  };

  const renderJobsView = () => {
    return (
      <div className="jobs-view-panel animate-fade-in">
        <div className="view-header">
          <h2>Job Openings Specification</h2>
          <p className="subtitle">Select or create job openings, configure description details and must-have requirement lists.</p>
        </div>

        <div className="jobs-layout-grid">
          {/* Left panel: job list selector */}
          <div className="job-list-card card">
            <h3 className="card-title">Select Active Job</h3>
            <div className="job-select-wrapper">
              <select
                className="input-text select-job"
                value={activeJobId}
                onChange={(e) => handleSelectJob(e.target.value)}
              >
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>{job.title}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn-primary btn-add-job"
                onClick={() => setIsJobModalOpen(true)}
              >
                + Create Job
              </button>
            </div>
            
            <div className="quick-templates-section">
              <h4>AI Templates Generator</h4>
              <p className="help-text">Load pre-configured specs for common roles:</p>
              <div className="templates-button-grid">
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => {
                    setJobTitle(JD_TEMPLATES.react_developer.title);
                    setJobDescription(JD_TEMPLATES.react_developer.description);
                    setMustHaves(JD_TEMPLATES.react_developer.mustHaves);
                  }}
                >
                  React Frontend
                </button>
                <button 
                  type="button" 
                  className="btn-secondary" 
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
                  onClick={() => {
                    setJobTitle(JD_TEMPLATES.product_manager.title);
                    setJobDescription(JD_TEMPLATES.product_manager.description);
                    setMustHaves(JD_TEMPLATES.product_manager.mustHaves);
                  }}
                >
                  Product Manager
                </button>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => {
                    setJobTitle(JD_TEMPLATES.qa_automation_engineer.title);
                    setJobDescription(JD_TEMPLATES.qa_automation_engineer.description);
                    setMustHaves(JD_TEMPLATES.qa_automation_engineer.mustHaves);
                  }}
                >
                  QA Automation
                </button>
              </div>
            </div>
          </div>

          {/* Right panel: job specifications editor */}
          <div className="job-editor-card card">
            <div className="editor-header">
              <h3 className="card-title">Job Specification Editor</h3>
              <button 
                type="button" 
                className="btn-secondary btn-upload-jd" 
                onClick={() => jdFileInputRef.current?.click()}
              >
                <Upload size={14} /> Upload JD Document
              </button>
              <input 
                type="file" 
                ref={jdFileInputRef} 
                style={{ display: 'none' }} 
                accept=".pdf,.docx,.txt"
                onChange={handleJdFileUpload} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Opening Title</label>
              <input 
                type="text" 
                className="input-text" 
                placeholder="e.g. Senior Frontend Engineer (React)"
                value={jobTitle}
                onChange={(e) => handleUpdateJobField('title', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Full Job Description</label>
              <textarea 
                className="input-textarea jd-textarea" 
                placeholder="Paste comprehensive job details, roles, responsibilities, and qualifications..."
                value={jobDescription}
                onChange={(e) => handleUpdateJobField('description', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Must-Have Requirement Checklist (comma-separated)</label>
              <textarea 
                className="input-textarea must-haves-textarea" 
                placeholder="e.g. React, TypeScript, 5+ years experience, Git"
                value={mustHaves}
                onChange={(e) => handleUpdateJobField('mustHaves', e.target.value)}
              />
              <span className="help-text">Requirements matching supports year-count extraction (e.g. 5+ years experience) and keyword validation.</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCandidatesView = () => {
    const activeFilterCount = [
      searchQuery.trim() !== '',
      minScoreFilter > 50,
      maxExpectedCtc < 60,
      noticePeriodFilter !== 'any',
      locationFilter.trim() !== '',
      stageFilter !== 'all',
      verdictFilter !== 'all',
      activeSkillFilters.length > 0,
    ].filter(Boolean).length;

    const readyCount = enrichedCandidates.filter(c => c.status === 'ready').length;
    const hasCompleted = enrichedCandidates.some(c => c.status === 'completed');

    return (
      <div className="candidates-view-panel animate-fade-in">
        {/* KPI stats ribbon */}
        {hasCompleted && (
          <div className="kpi-grid">
            <div className="card kpi-card avg-score">
              <div className="kpi-icon-container avg-score"><TrendingUp size={20} /></div>
              <div>
                <span className="kpi-label">Average Score</span>
                <h3 className="kpi-value">{kpis.avgScore}%</h3>
              </div>
            </div>
            <div className="card kpi-card screened">
              <div className="kpi-icon-container screened"><Users size={20} /></div>
              <div>
                <span className="kpi-label">Screened</span>
                <h3 className="kpi-value">{kpis.count} Candidates</h3>
              </div>
            </div>
            <div className="card kpi-card immediate">
              <div className="kpi-icon-container immediate"><Zap size={20} /></div>
              <div>
                <span className="kpi-label">Immediate</span>
                <h3 className="kpi-value">{kpis.immediateCount} Profiles</h3>
              </div>
            </div>
            <div className="card kpi-card budget">
              <div className="kpi-icon-container budget"><DollarSign size={20} /></div>
              <div>
                <span className="kpi-label">Under Budget</span>
                <h3 className="kpi-value">{kpis.underBudgetCount} Matches</h3>
              </div>
            </div>
          </div>
        )}

        {/* Filter & Toolbar Area */}
        <div className="toolbar-section">
          {/* Row 1: Search + Quick filters + View switch */}
          <div className="toolbar-main-row">
            {/* Search input */}
            <div className="search-bar-wrapper">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                className="input-text search-input" 
                placeholder="Search candidates by name, email, skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" className="clear-search-btn" onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>

            {/* Verdict quick toggles */}
            <div className="verdict-filter-pills">
              {[
                { val: 'all', label: 'All Candidates' },
                { val: 'Shortlisted', label: 'Shortlisted' },
                { val: 'Borderline', label: 'Borderline' },
                { val: 'Not a fit', label: 'Not a Fit' }
              ].map(item => (
                <button
                  key={item.val}
                  type="button"
                  className={`filter-pill-btn ${verdictFilter === item.val ? 'active' : ''} ${item.val.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setVerdictFilter(item.val)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Sorting */}
            <div className="sort-wrapper">
              <span className="sort-label">Sort:</span>
              <select
                className="input-text sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="score_desc">Score: High → Low</option>
                <option value="score_asc">Score: Low → High</option>
                <option value="name_asc">Name: A → Z</option>
                <option value="name_desc">Name: Z → A</option>
                <option value="ctc_asc">Expected CTC: Low → High</option>
                <option value="ctc_desc">Expected CTC: High → Low</option>
                <option value="notice_asc">Notice Period: Shortest</option>
              </select>
            </div>

            {/* View toggles */}
            <div className="view-mode-selector">
              <button 
                type="button" 
                className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                Grid View
              </button>
              <button 
                type="button" 
                className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
                onClick={() => setViewMode('kanban')}
              >
                Kanban Board
              </button>
              <button 
                type="button" 
                className={`view-toggle-btn ${viewMode === 'analytics' ? 'active' : ''}`}
                onClick={() => setViewMode('analytics')}
              >
                Hiring Analytics
              </button>
            </div>

            {/* Advanced Filters Trigger */}
            <button
              type="button"
              className={`btn-filters-toggle ${isFilterPanelOpen ? 'active' : ''}`}
              onClick={() => setIsFilterPanelOpen(p => !p)}
            >
              ⚙ Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </button>
          </div>

          {/* Row 2: Advanced filters panel */}
          {isFilterPanelOpen && (
            <div className="advanced-filters-panel animate-fade-in card">
              <div className="filter-grid">
                <div className="filter-group-item">
                  <label className="filter-label">Min ATS Match Score</label>
                  <div className="slider-wrapper">
                    <input type="range" min="50" max="95" value={minScoreFilter} onChange={(e) => setMinScoreFilter(parseInt(e.target.value))} />
                    <span className="slider-value font-mono">{minScoreFilter}+</span>
                  </div>
                </div>

                <div className="filter-group-item">
                  <label className="filter-label">Max Expected CTC (LPA)</label>
                  <div className="slider-wrapper">
                    <input type="range" min="5" max="80" value={maxExpectedCtc} onChange={(e) => setMaxExpectedCtc(parseInt(e.target.value))} />
                    <span className="slider-value font-mono">{maxExpectedCtc}L</span>
                  </div>
                </div>

                <div className="filter-group-item">
                  <label className="filter-label">Max Notice Period</label>
                  <select className="input-text" value={noticePeriodFilter} onChange={(e) => setNoticePeriodFilter(e.target.value)}>
                    <option value="any">Any Notice Period</option>
                    <option value="immediate">Immediate Only</option>
                    <option value="15">Within 15 Days</option>
                    <option value="30">Within 30 Days</option>
                    <option value="60">Within 60 Days</option>
                  </select>
                </div>

                <div className="filter-group-item">
                  <label className="filter-label">Pipeline Hiring Stage</label>
                  <select className="input-text" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                    <option value="all">All Stages</option>
                    <option value="screening">Screening</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="interviewing">Interviewing</option>
                    <option value="offer">Offer Extended</option>
                    <option value="hired">Hired 🎉</option>
                    <option value="rejected">Declined</option>
                  </select>
                </div>

                <div className="filter-group-item">
                  <label className="filter-label">Candidate Location</label>
                  <input type="text" className="input-text" placeholder="e.g. Pune, Bangalore" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} />
                </div>

                <div className="filter-group-item reset-wrapper">
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      className="btn-secondary btn-clear-filters"
                      onClick={() => {
                        setSearchQuery('');
                        setMinScoreFilter(50);
                        setMaxExpectedCtc(60);
                        setNoticePeriodFilter('any');
                        setLocationFilter('');
                        setStageFilter('all');
                        setVerdictFilter('all');
                        setActiveSkillFilters([]);
                        setSortBy('score_desc');
                      }}
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Row 3: Active Filter Chips */}
          {activeFilterCount > 0 && (
            <div className="active-filters-chips-row">
              <span className="chips-title">Active:</span>
              {verdictFilter !== 'all' && <span className="filter-chip active-verdict" onClick={() => setVerdictFilter('all')}>Verdict: {verdictFilter} ✕</span>}
              {stageFilter !== 'all' && <span className="filter-chip" onClick={() => setStageFilter('all')}>Stage: {stageFilter} ✕</span>}
              {searchQuery.trim() !== '' && <span className="filter-chip" onClick={() => setSearchQuery('')}>Search: "{searchQuery.slice(0, 15)}" ✕</span>}
              {minScoreFilter > 50 && <span className="filter-chip" onClick={() => setMinScoreFilter(50)}>Score ≥ {minScoreFilter} ✕</span>}
              {maxExpectedCtc < 60 && <span className="filter-chip" onClick={() => setMaxExpectedCtc(60)}>Salary ≤ {maxExpectedCtc}L ✕</span>}
              {noticePeriodFilter !== 'any' && <span className="filter-chip" onClick={() => setNoticePeriodFilter('any')}>Notice: {noticePeriodFilter === 'immediate' ? 'Immediate' : `≤${noticePeriodFilter}d`} ✕</span>}
              {locationFilter.trim() !== '' && <span className="filter-chip" onClick={() => setLocationFilter('')}>Loc: {locationFilter} ✕</span>}
              {activeSkillFilters.map(sk => <span key={sk} className="filter-chip active-skill" onClick={() => handleToggleSkillFilter(sk)}>Skill: {sk} ✕</span>)}
              <span className="results-count-badge">{completedCandidates.filter(c => c.status === 'completed').length} matching profile(s)</span>
            </div>
          )}
        </div>

        {/* Skill Cloud filters */}
        {hasCompleted && (
          <div className="skill-cloud-card card">
            <div className="card-header">
              <span className="header-label">🔥 Skill Filter Cloud</span>
              {activeSkillFilters.length > 0 && (
                <button type="button" className="btn-secondary clear-skills-btn" onClick={() => setActiveSkillFilters([])}>Clear Tags</button>
              )}
            </div>
            <div className="tags-container">
              {getTrendingSkills().map(skill => {
                const isActive = activeSkillFilters.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    className={`skill-tag-chip ${isActive ? 'active' : ''}`}
                    onClick={() => handleToggleSkillFilter(skill)}
                  >
                    {skill} {isActive ? '✕' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Screening Actions and Drag Drop area */}
        <div className="screening-workspace-grid">
          {/* Uploader panel */}
          <div className="card uploader-card">
            <h3 className="card-title">Upload Candidates & Résumés</h3>
            <div 
              className={`dropzone ${dragActive ? 'active' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => candidateFileInputRef.current?.click()}
            >
              <Upload size={28} className="upload-icon" />
              <p className="main-prompt">Drag & drop resumes or <span className="browse-link">browse files</span></p>
              <p className="sub-prompt">Supports PDF, DOCX, TXT, PNG, JPG, WEBP</p>
              <input 
                type="file" 
                ref={candidateFileInputRef} 
                style={{ display: 'none' }} 
                multiple 
                accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
                onChange={handleBrowseFiles}
              />
            </div>

            {/* Paste Fallback alternative */}
            <div className="paste-fallback-section">
              <button 
                type="button" 
                className="btn-secondary btn-toggle-paste"
                onClick={() => setPasteFallbackOpen(!pasteFallbackOpen)}
              >
                <span>Paste Resume Text Alternative</span>
                {pasteFallbackOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {pasteFallbackOpen && (
                <div className="paste-form animate-fade-in">
                  <input type="text" className="input-text input-name" placeholder="Candidate Full Name" value={pasteName} onChange={(e) => setPasteName(e.target.value)} />
                  <textarea className="input-textarea input-resume-text" placeholder="Paste full resume copy text..." value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
                  <button type="button" className="btn-primary btn-save-paste" onClick={handleAddManualCandidate} disabled={!pasteText.trim()}>Save Candidate</button>
                </div>
              )}
            </div>

            {/* Screening trigger execution widget */}
            <div className="screening-action-box">
              <button 
                type="button" 
                className="btn-primary btn-screen-trigger"
                onClick={handleScreenAndRank}
                disabled={isScreening || readyCount === 0}
              >
                {isScreening ? (
                  <>
                    <RefreshCw className="spinner" size={16} />
                    <span>Screening {currentScreenIndex + 1} of {candidates.length}...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Run Screening Parser ({readyCount} Ready)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Queue file status list */}
          <div className="card queue-card">
            <div className="queue-header">
              <h3 className="card-title">Candidates File Queue ({candidates.length})</h3>
              {candidates.length > 0 && (
                <button type="button" className="btn-clear-all" onClick={() => setCandidates([])}><Trash2 size={12} /> Clear Queue</button>
              )}
            </div>
            
            {candidates.length === 0 ? (
              <div className="queue-empty-state">
                <p>No documents uploaded yet. Upload PDF/Docx files to build screening queue.</p>
              </div>
            ) : (
              <div className="file-list scroll-container">
                {enrichedCandidates.map((candidate) => (
                  <div key={candidate.id} className="file-row">
                    <div className="file-info">
                      <FileText size={16} className="file-icon" />
                      <div className="meta">
                        <span className="file-name">{candidate.name}</span>
                        <span className="file-size">{formatBytes(candidate.fileSize)}</span>
                      </div>
                    </div>

                    <div className="status-actions">
                      {candidate.status === 'reading' && <span className="status-indicator reading"><span className="dot reading"></span>reading...</span>}
                      {candidate.status === 'ocr_progress' && <span className="status-indicator ocr"><span className="dot ocr"></span>OCR {candidate.ocrProgress}%</span>}
                      {candidate.status === 'ready' && <span className="status-indicator ready"><span className="dot ready"></span>Ready</span>}
                      {candidate.status === 'screening' && <span className="status-indicator screening">Screening...</span>}
                      {candidate.status === 'completed' && <span className="status-indicator score">Score: {candidate.score}</span>}
                      {candidate.status === 'failed' && <span className="status-indicator error"><span className="dot error"></span>Failed</span>}
                      
                      <button type="button" className="btn-remove-row" onClick={() => removeCandidate(candidate.id)}><Trash2 size={12} /></button>
                    </div>

                    {candidate.status === 'failed' && (
                      <div className="failed-error-panel animate-fade-in">
                        <p className="error-text">Parse Error: {candidate.errorDetails}</p>
                        <button type="button" className="btn-secondary" onClick={() => handleOcrRetry(candidate.id)}>Run OCR Retry</button>
                        <textarea className="input-textarea fix-textarea" placeholder="Paste resume details manually to recover..." onChange={(e) => handleManualTextPasteFix(candidate.id, e.target.value)} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Batch selection status ribbon */}
        {completedScoredCandidates.length > 0 && (
          <div className="selection-action-bar animate-fade-in">
            <div className="selection-status">
              <label className="checkbox-container">
                <input 
                  type="checkbox"
                  checked={completedScoredCandidates.length > 0 && completedScoredCandidates.every(c => selectedCandidateIds.includes(c.id))}
                  onChange={() => handleToggleSelectAll(completedScoredCandidates)}
                />
                <span className="checkbox-checkmark"></span>
              </label>
              <span>{selectedCandidateIds.length} of {completedScoredCandidates.length} Candidates Selected</span>
            </div>

            <div className="action-buttons">
              {selectedCandidateIds.length > 1 && (
                <button type="button" className="btn-primary btn-compare" onClick={() => setIsCompareModalOpen(true)}>Compare ({selectedCandidateIds.length})</button>
              )}
              {selectedCandidateIds.length > 0 && (
                <button type="button" className="btn-primary btn-email" onClick={handleOpenEmailModal}>✉ Batch Email ({selectedCandidateIds.length})</button>
              )}
              {selectedCandidateIds.length > 0 && (
                <button type="button" className="btn-secondary btn-export" onClick={handleExportCsv}>Export CSV ({selectedCandidateIds.length})</button>
              )}
              <button type="button" className="btn-secondary" onClick={() => setSelectedCandidateIds([])} disabled={selectedCandidateIds.length === 0}>Clear Selection</button>
            </div>
          </div>
        )}

        {/* Candidates output display */}
        <div className="candidates-list-workspace">
          {viewMode === 'analytics' ? (
            renderAnalyticsDashboard()
          ) : viewMode === 'kanban' ? (
            renderKanbanBoard()
          ) : (
            <div className="candidate-grid">
              {completedCandidates.map((candidate, idx) => {
                if (candidate.status === 'screening') {
                  return (
                    <div key={candidate.id} className="candidate-card screening-card animate-pulse card">
                      <RefreshCw className="spinner" size={28} />
                      <h4>Screening Profile</h4>
                      <p>{candidate.name}</p>
                    </div>
                  );
                }

                if (candidate.status === 'failed') {
                  return (
                    <div key={candidate.id} className="candidate-card failed-card card">
                      <div className="card-header">
                        <h4>Parse Failed</h4>
                        <span>{candidate.name}</span>
                      </div>
                      <p className="error-text">Details: {candidate.errorDetails}</p>
                    </div>
                  );
                }

                const displayScore = getCandidateDisplayScore(candidate);
                const outcome = getNextStepDetails(displayScore, threshold);
                const evalData = candidate.evaluation || analyzeCandidateOffline(candidate, jobTitle, jobDescription, mustHaves);
                const isUnderBudget = (evalData.expected_ctc || candidate.expectedCtc || 0) <= 25;
                const isShortNotice = ['Immediate', '15 days', '30 days'].includes(evalData.notice_period || candidate.noticePeriod);

                return (
                  <article 
                    key={candidate.id} 
                    className={`candidate-card card ${outcome.badgeClass}`}
                    onClick={() => {
                      setDrawerActiveTab('overview');
                      setActiveDrawerCandidateId(candidate.id);
                    }}
                  >
                    <div className="card-top" onClick={(e) => e.stopPropagation()}>
                      <label className="checkbox-container">
                        <input type="checkbox" checked={selectedCandidateIds.includes(candidate.id)} onChange={() => handleToggleSelectCandidate(candidate.id)} />
                        <span className="checkbox-checkmark"></span>
                      </label>
                      
                      <div className="candidate-meta-details">
                        <div className="name-row">
                          <span className="rank-badge">Rank #{idx + 1}</span>
                          <h3 className="name">{evalData.candidate_name || candidate.name}</h3>
                        </div>
                        <div className="meta-tags">
                          <span className="tag">⚡ {evalData.notice_period || candidate.noticePeriod}</span>
                          <span className="tag">💰 {evalData.expected_ctc || candidate.expectedCtc} LPA</span>
                          <span className="tag">📍 {evalData.location || candidate.location}</span>
                        </div>
                      </div>

                      <div className="score-meter">
                        <div className={`score-badge ${displayScore >= threshold ? 'high' : displayScore >= threshold - 15 ? 'medium' : 'low'}`}>
                          {displayScore}
                        </div>
                        <span className="score-label">ATS Score</span>
                      </div>
                    </div>

                    <div className="card-body">
                      <div className="verdict-banner">
                        <span className={`verdict ${outcome.badgeClass}`}>{outcome.badge} Match</span>
                        {candidate.interview && <span className="verdict scheduled">📅 Interview</span>}
                        {sentEmails[candidate.id] && <span className="verdict emailed">✉ Emailed</span>}
                      </div>

                      <div className="strengths-risks-preview">
                        <div className="strengths">
                          <strong>Strengths:</strong>
                          <p>{evalData.strengths?.[0] || 'Standard skillset matched'}</p>
                        </div>
                        <div className="risks">
                          <strong>Risks:</strong>
                          <p>{evalData.risks?.[0] || 'No critical risks identified'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="card-footer" onClick={(e) => e.stopPropagation()}>
                      <select 
                        value={candidate.stage || 'screening'} 
                        onChange={(e) => handleMoveStage(candidate.id, e.target.value)}
                        className="stage-dropdown"
                      >
                        <option value="screening">Screening</option>
                        <option value="shortlisted">Shortlist</option>
                        <option value="interviewing">Interview</option>
                        <option value="offer">Offer Extended</option>
                        <option value="hired">Hired 🎉</option>
                        <option value="rejected">Decline</option>
                      </select>

                      <div className="footer-actions">
                        <button type="button" className="btn-secondary" onClick={() => handleDraftEmail(candidate)}>Draft Email</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCareersView = () => {
    return (
      <div className="careers-view-panel animate-fade-in">
        <div className="view-header">
          <h2>Branded Careers Page Portal</h2>
          <p className="subtitle">Customize visual styles and test the public candidate application portal. Form inputs directly parse submissions into the ATS screening queue.</p>
        </div>

        <div className="careers-layout-grid card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', minHeight: '600px', flex: 1 }}>
            {/* Customizer Panel */}
            <div className="customizer-panel" style={{ width: '280px', borderRight: '1px solid var(--color-border)', backgroundColor: 'var(--color-paper-darker)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <span className="panel-section-title" style={{ fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>Visual Settings</span>
              
              <div className="form-group">
                <label className="form-label text-xs">Color Palette</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[
                    { id: 'indigo', name: 'Indigo Corporate 🔵', color: '#4F46E5' },
                    { id: 'emerald', name: 'Emerald Creative 🟢', color: '#10B981' },
                    { id: 'terracotta', name: 'Terracotta Warm 🟤', color: '#C85A32' }
                  ].map(thm => (
                    <button
                      key={thm.id}
                      type="button"
                      onClick={() => setCareersTheme(thm.id)}
                      className={`btn-secondary ${careersTheme === thm.id ? 'active' : ''}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-start',
                        border: '1.5px solid ' + (careersTheme === thm.id ? thm.color : 'var(--color-border)'),
                        background: careersTheme === thm.id ? 'var(--color-white)' : 'transparent',
                        padding: '0.5rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '6px'
                      }}
                    >
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: thm.color, display: 'inline-block' }} />
                      {thm.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label text-xs">Font Typography</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[
                    { id: 'sans', name: 'Modern Sans-Serif', family: 'var(--font-body)' },
                    { id: 'serif', name: 'Elegant Serif', family: 'var(--font-display)' },
                    { id: 'mono', name: 'Technical Monospace', family: 'var(--font-mono)' }
                  ].map(fnt => (
                    <button
                      key={fnt.id}
                      type="button"
                      onClick={() => setCareersFont(fnt.id)}
                      className={`btn-secondary ${careersFont === fnt.id ? 'active' : ''}`}
                      style={{
                        justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '6px',
                        border: '1.5px solid ' + (careersFont === fnt.id ? 'var(--color-terracotta)' : 'var(--color-border)'),
                        background: careersFont === fnt.id ? 'var(--color-white)' : 'transparent',
                        fontFamily: fnt.family
                      }}
                    >
                      {fnt.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Portal Live Preview */}
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
              if (careersFont === 'serif') fontStyle = 'var(--font-display)';
              else if (careersFont === 'mono') fontStyle = 'var(--font-mono)';

              const handleCareersSubmit = (e) => {
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
                  alert(`🎉 Application received! ${appFormName} has been loaded into your screening queue.`);
                }, 1200);
              };

              return (
                <div style={{ flex: 1, padding: '2.5rem', overflowY: 'auto', backgroundColor: '#FFFFFF', fontFamily: fontStyle, color: '#1E293B' }}>
                  {appSubmitted ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', textAlign: 'center' }}>
                      <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: `3px solid ${primaryColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={32} style={{ color: primaryColor }} />
                      </div>
                      <h4 style={{ fontSize: '1.25rem', color: primaryColor, margin: 0 }}>Application Transmitting...</h4>
                      <p className="text-sm text-muted">Injecting application data into RecruitPro ATS dashboard</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '1.25rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: primaryColor, letterSpacing: '0.05em' }}>Public Opening</span>
                        <h2 style={{ fontSize: '1.75rem', color: '#0F172A', margin: '0.25rem 0' }}>{jobTitle}</h2>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                          <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: '#F1F5F9', borderRadius: '4px' }}>📍 Bangalore, IN</span>
                          <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: '#F1F5F9', borderRadius: '4px' }}>💼 Full-Time</span>
                          <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: '#F1F5F9', borderRadius: '4px' }}>💰 Competitive Salary</span>
                        </div>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--color-ink-muted)', marginBottom: '0.5rem' }}>Requirements Description</h4>
                        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '1rem', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                          <pre style={{ fontFamily: 'inherit', fontSize: '0.85rem', whiteSpace: 'pre-wrap', color: '#334155', margin: 0, lineHeight: '1.5' }}>{jobDescription}</pre>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.1rem', color: primaryColor, marginBottom: '1rem' }}>Submit Application Form</h3>
                        <form onSubmit={handleCareersSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label text-xs">Full Name</label>
                              <input type="text" className="input-text" placeholder="e.g. Rohan Sharma" value={appFormName} onChange={(e) => setAppFormName(e.target.value)} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label text-xs">Email Address</label>
                              <input type="email" className="input-text" placeholder="e.g. rohan@email.com" value={appFormEmail} onChange={(e) => setAppFormEmail(e.target.value)} required />
                            </div>
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label text-xs">Paste Resume Content Text</label>
                            <textarea className="input-textarea" style={{ minHeight: '120px' }} placeholder="Paste your detailed resume profile bio here..." value={appFormResume} onChange={(e) => setAppFormResume(e.target.value)} required />
                          </div>
                          <button
                            type="submit"
                            className="btn-primary"
                            style={{
                              width: 'auto', alignSelf: 'flex-start', padding: '0.6rem 1.75rem', fontSize: '0.85rem',
                              background: `linear-gradient(135deg, ${primaryColor}, ${hoverColor})`, boxShadow: 'none'
                            }}
                          >
                            Submit Online Application
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  const renderTemplatesView = () => {
    return (
      <div className="templates-view-panel animate-fade-in">
        <div className="view-header">
          <h2>Email Templates Customizer & Queue</h2>
          <p className="subtitle">Configure and customize standardized email layouts for candidate status updates. Insert dynamic placeholders for personalized mail drafts.</p>
        </div>

        <div className="templates-layout-grid">
          {/* Templates list card */}
          <div className="templates-list-card card">
            <h3 className="card-title">Base Layouts</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
              {emailTemplates.map(t => {
                const isActive = selectedTemplateId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`btn-secondary ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedTemplateId(t.id);
                      setTempSubject(t.subject);
                      setTempBody(t.body);
                    }}
                    style={{
                      justifyContent: 'flex-start', padding: '0.6rem 1rem', fontSize: '0.85rem', cursor: 'pointer', borderRadius: '6px',
                      border: '1.5px solid ' + (isActive ? 'var(--color-terracotta)' : 'var(--color-border)'),
                      background: isActive ? 'var(--color-terracotta-light)' : 'transparent',
                      color: isActive ? 'var(--color-terracotta)' : 'var(--color-ink)'
                    }}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Template editor card */}
          {(() => {
            const activeTemplate = emailTemplates.find(x => x.id === selectedTemplateId) || emailTemplates[0];
            
            const handleEditorSave = () => {
              setEmailTemplates(prev => prev.map(t => {
                if (t.id === selectedTemplateId) {
                  return { ...t, subject: tempSubject, body: tempBody };
                }
                return t;
              }));
              alert("🎉 Template updated and saved successfully!");
            };

            const insertTextPlaceholder = (target, value) => {
              insertPlaceholder(target, value);
            };

            return (
              <div className="template-editor-card card">
                <div className="editor-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                  <h3 className="card-title">Edit Template: <span style={{ color: 'var(--color-terracotta)' }}>{activeTemplate.name}</span></h3>
                  <button type="button" className="btn-primary" style={{ width: 'auto', padding: '0.45rem 1.25rem', fontSize: '0.85rem' }} onClick={handleEditorSave}>Save Template Changes</button>
                </div>

                <div className="form-group">
                  <label className="form-label">Subject Pattern</label>
                  <input
                    type="text"
                    ref={tempSubjectRef}
                    className="input-text text-sm"
                    value={tempSubject}
                    onChange={(e) => setTempSubject(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                    {['{{candidateName}}', '{{jobTitle}}', '{{matchedSkills}}'].map(tag => (
                      <button key={tag} type="button" className="btn-secondary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }} onClick={() => insertTextPlaceholder('subject', tag)}>+ {tag}</button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Email Body Template</label>
                  <textarea
                    ref={tempBodyRef}
                    className="input-textarea template-body-textarea"
                    style={{ minHeight: '220px', fontSize: '0.88rem' }}
                    value={tempBody}
                    onChange={(e) => tempBodyRef.current ? setTempBody(e.target.value) : setTempBody(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                    {['{{candidateName}}', '{{jobTitle}}', '{{matchedSkills}}'].map(tag => (
                      <button key={tag} type="button" className="btn-secondary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }} onClick={() => insertTextPlaceholder('body', tag)}>+ {tag}</button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Sent Emails History Queue */}
        {Object.keys(sentEmails).length > 0 && (
          <div className="sent-emails-queue card" style={{ marginTop: '1.5rem' }}>
            <h3 className="card-title">Sent Emails Logs History ({Object.keys(sentEmails).length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
              {Object.entries(sentEmails).map(([id, details]) => {
                const candidate = candidates.find(c => c.id === id);
                return (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', border: '1px solid var(--color-border)', borderRadius: '6px', backgroundColor: 'var(--color-paper-light)', fontSize: '0.82rem' }}>
                    <div>
                      <strong style={{ color: 'var(--color-ink)' }}>{candidate?.name || 'Candidate'}</strong>
                      <span className="text-muted" style={{ margin: '0 0.5rem' }}>→</span>
                      <span className="mono-font" style={{ color: 'var(--color-terracotta)' }}>{details.email}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span className="text-xs text-muted">Sent at: {details.sentAt}</span>
                      <span style={{ color: 'var(--color-sage)', fontWeight: 'bold' }}>✓ Dispatched</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSettingsView = () => {
    const sqlScript = `-- SQL DDL setup for RecruitPro ATS
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

    return (
      <div className="settings-view-panel animate-fade-in">
        <div className="view-header">
          <h2>System Configuration & Database Setup</h2>
          <p className="subtitle">Tune candidate screening parameters and verify live external database integrations.</p>
        </div>

        <div className="settings-layout-grid">
          {/* Threshold slider card */}
          <div className="threshold-card card">
            <h3 className="card-title">Hiring Threshold Scorecard</h3>
            <p className="help-text" style={{ marginBottom: '1.25rem' }}>Adjust the minimum weighted match percentage needed to mark profiles as Shortlisted.</p>
            
            <div className="slider-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span className="text-muted">Shortlist Bar</span>
                <span style={{ color: 'var(--color-terracotta)', fontSize: '1.1rem' }}>{threshold} / 100</span>
              </div>
              <input 
                type="range" 
                min="50" 
                max="95" 
                value={threshold} 
                onChange={(e) => setThreshold(parseInt(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <span className="text-xs text-muted" style={{ marginTop: '0.25rem' }}>Candidates matching lower than {threshold}% will default to Borderline or Decline recommendation filters.</span>
            </div>
          </div>

          {/* Supabase status verification card */}
          <div className="supabase-card card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 className="card-title">Supabase Database Integration</h3>
              <span className={`status-badge-text font-mono ${supabaseStatus}`} style={{
                fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.6rem', borderRadius: '4px',
                backgroundColor: supabaseStatus === 'connected' ? 'var(--color-sage-light)' : supabaseStatus === 'schema_missing' ? '#FEF3C7' : 'var(--color-red-light)',
                color: supabaseStatus === 'connected' ? 'var(--color-sage)' : supabaseStatus === 'schema_missing' ? 'orange' : 'var(--color-red)'
              }}>
                {supabaseStatus.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn-secondary" onClick={() => verifySupabaseConnection(true)}>Verify Sync Connection</button>
                {supabaseStatus === 'connected' && (
                  <button type="button" className="btn-primary" style={{ width: 'auto', padding: '0.45rem 1.25rem' }} onClick={seedSupabase} disabled={isSeeding}>
                    {isSeeding ? 'Seeding...' : 'Seed Sample Database Records'}
                  </button>
                )}
              </div>

              {supabaseError && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: 'var(--color-red)', fontSize: '0.8rem' }}>
                  <strong>Error:</strong> {supabaseError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span className="form-label text-xs">Supabase Project Endpoint</span>
                <input type="text" readOnly className="input-text text-sm" style={{ backgroundColor: 'var(--color-paper-darker)', color: 'var(--color-ink-muted)', cursor: 'default' }} value="https://hqtpxaeuhsovwhevztzi.supabase.co" />
              </div>

              {/* SQL script schema DDL setup */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="form-label text-xs">Table Schema Setup script (DDL)</span>
                  <button type="button" className="btn-secondary" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }} onClick={() => { navigator.clipboard.writeText(sqlScript); alert("Copied SQL Schema!"); }}>Copy SQL</button>
                </div>
                <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '0.75rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.72rem', overflowX: 'auto', maxHeight: '180px', border: '1px solid var(--color-border)' }}>
                  {sqlScript}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-spinner" />
      </div>
    );
  }  // --- LINKEDIN PORTAL INTEGRATION CODE ---
  const handleImportLinkedInJob = (job) => {
    const isAlreadyImported = jobs.some(j => j.title.toLowerCase() === job.title.toLowerCase());
    if (isAlreadyImported) {
      alert("A job with this title is already imported in the ATS!");
      return;
    }
    const newJobId = `job-imported-${Date.now()}`;
    const newJob = {
      id: newJobId,
      title: job.title,
      description: job.description || `We are looking for a ${job.title} at ${job.company}. Location: ${job.location}`,
      mustHaves: job.requirements || 'React, JavaScript, CSS'
    };

    setJobs(prev => [...prev, newJob]);
    setActiveJobId(newJobId);
    setJobTitle(newJob.title);
    setJobDescription(newJob.description);
    setMustHaves(newJob.mustHaves);
    
    alert(`🎉 Successfully imported "${job.title}" from LinkedIn into your Jobs Dashboard!`);
    setSelectedSearchResult(null);
    setActiveSidebarTab('jobs'); // Redirect to Jobs Dashboard
  };

  const fetchLinkedInProfileId = async (token) => {
    try {
      const profile = await fetchLinkedInProfileDetails(token);
      return profile.id;
    } catch (e) {
      throw e;
    }
  };

  const publishToLinkedInFeed = async (token, personId, text) => {
    try {
      const res = await fetch(getLinkedInApiUrl('v2/ugcShares'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify({
          "author": `urn:li:person:${personId}`,
          "lifecycleState": "PUBLISHED",
          "specificContent": {
            "com.linkedin.ugc.ShareContent": {
              "shareCommentary": {
                "text": text
              },
              "shareMediaCategory": "NONE"
            }
          },
          "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
          }
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`[HTTP ${res.status}] ${res.statusText || 'Error'}: ${errText}`);
      }
      const data = await res.json();
      return data;
    } catch (e) {
      if (e.message.includes('Failed to fetch')) {
        throw new Error("Network error (Failed to fetch). Please make sure you have stopped and restarted your 'npm run dev' terminal server after the vite.config.js update to load the proxy settings.");
      }
      throw e;
    }
  };

  const handleAuthorizeLinkedIn = async () => {
    if (linkedInMode === 'live') {
      if (!linkedInClientId.trim() || !linkedInClientSecret.trim()) {
        alert("Please enter both Client ID and Client Secret under Settings first!");
        return;
      }
      
      // Save credentials in localStorage
      localStorage.setItem('rp_linkedin_client_id', linkedInClientId.trim());
      localStorage.setItem('rp_linkedin_client_secret', linkedInClientSecret.trim());
      localStorage.setItem('rp_linkedin_redirect_uri', linkedInRedirectUri.trim());
      localStorage.setItem('rp_linkedin_mode', 'live');

      // Generate PKCE code verifier and challenge
      const codeVerifier = generateRandomString(64);
      localStorage.setItem('rp_linkedin_code_verifier', codeVerifier);
      
      let challenge = '';
      try {
        challenge = await generateCodeChallenge(codeVerifier);
      } catch (err) {
        console.error("PKCE Challenge generation failed:", err);
        alert("PKCE security generation failed. Reverting to basic OAuth.");
      }

      const scope = encodeURIComponent('w_member_social openid profile email');
      let authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${linkedInClientId.trim()}&redirect_uri=${encodeURIComponent(linkedInRedirectUri.trim())}&scope=${scope}&state=rp_${Date.now()}`;
      
      if (challenge) {
        authUrl += `&code_challenge=${challenge}&code_challenge_method=S256`;
      }
      
      window.location.href = authUrl;
    } else {
      setIsLinkedInAuthOpen(true);
    }
  };

  const handlePostToLinkedIn = async () => {
    const isReady = linkedInMode === 'live' ? linkedInAccessToken.trim().length > 0 : linkedInConnected;
    if (!isReady) {
      alert(linkedInMode === 'live' 
        ? "Please enter your LinkedIn Access Token under Settings first!" 
        : "Please connect your LinkedIn account first under Settings!");
      setLinkedinActiveTab('settings');
      return;
    }
    
    const activeJob = jobs.find(j => j.id === selectedJobForLinkedIn);
    if (!activeJob) {
      alert("Please select a valid job to post.");
      return;
    }
    
    if (!linkedInShareText.trim()) {
      alert("Please provide some text to share.");
      return;
    }

    if (linkedInPostType === 'company' && !linkedInCompanyId.trim()) {
      alert("Please provide your LinkedIn Company ID to post on behalf of the company.");
      return;
    }

    setIsPostingToLinkedIn(true);
    setLinkedInPostSuccess(false);

    if (linkedInMode === 'sandbox') {
      // Simulated API call latency
      setTimeout(() => {
        const newPostId = `li-post-${Date.now()}`;
        const newShareUrl = `https://www.linkedin.com/feed/update/urn:li:share:${Math.floor(1000000000000000 + Math.random() * 9000000000000000)}`;
        
        const newPost = {
          id: newPostId,
          jobId: activeJob.id,
          jobTitle: activeJob.title,
          postType: linkedInPostType,
          shareText: linkedInShareText,
          postedAt: new Date().toLocaleString(),
          status: 'Live',
          views: 0,
          clicks: 0,
          applies: 0,
          shareUrl: newShareUrl
        };

        setLinkedInPostHistory(prev => {
          const updated = [newPost, ...prev];
          localStorage.setItem('rp_linkedin_post_history', JSON.stringify(updated));
          return updated;
        });

        setLinkedInShareUrl(newShareUrl);
        setLinkedInPostSuccess(true);
        setIsPostingToLinkedIn(false);

        // Copy formatted recruiting text to user's clipboard
        navigator.clipboard.writeText(linkedInShareText)
          .then(() => {
            alert(`🎉 Simulated Publishing Complete!\n\n📋 The formatted job posting announcement has been copied to your clipboard.\n\nWe are now opening LinkedIn.com in a new tab. Simply paste (Ctrl+V) the text into the post editor to publish it live on your feed!`);
            window.open('https://www.linkedin.com/feed/', '_blank');
          })
          .catch((err) => {
            console.error("Clipboard copy failed: ", err);
            alert(`🎉 Simulated Publishing Complete!\n\nWe are opening LinkedIn.com in a new tab to create your post. Please copy the text from the preview card manually and paste it into LinkedIn.`);
            window.open('https://www.linkedin.com/feed/', '_blank');
          });
      }, 2000);
    } else {
      // Live API Mode
      if (!linkedInAccessToken.trim()) {
        alert("Please enter a valid LinkedIn Access Token in the Settings tab first.");
        setLinkedinActiveTab('settings');
        setIsPostingToLinkedIn(false);
        return;
      }

      try {
        // Step 1: Fetch profile ID
        const personId = await fetchLinkedInProfileId(linkedInAccessToken);
        
        // Step 2: Publish share
        const result = await publishToLinkedInFeed(linkedInAccessToken, personId, linkedInShareText);
        
        const newPostId = result.id || `li-post-live-${Date.now()}`;
        // LinkedIn URN formatting for url
        const urnPart = newPostId.includes(':') ? newPostId.split(':').pop() : newPostId;
        const newShareUrl = `https://www.linkedin.com/feed/update/urn:li:share:${urnPart}`;

        const newPost = {
          id: newPostId,
          jobId: activeJob.id,
          jobTitle: activeJob.title,
          postType: linkedInPostType,
          shareText: linkedInShareText,
          postedAt: new Date().toLocaleString(),
          status: 'Live',
          views: 0,
          clicks: 0,
          applies: 0,
          shareUrl: newShareUrl
        };

        setLinkedInPostHistory(prev => {
          const updated = [newPost, ...prev];
          localStorage.setItem('rp_linkedin_post_history', JSON.stringify(updated));
          return updated;
        });

        setLinkedInShareUrl(newShareUrl);
        setLinkedInPostSuccess(true);
        
        alert("🎉 Successfully posted job announcement live to your LinkedIn profile feed!");
      } catch (err) {
        console.error("LinkedIn Live Post Error: ", err);
        alert(`❌ Failed to publish to LinkedIn: ${err.message}\n\nMake sure your Access Token has the correct scopes ('w_member_social') and has not expired.`);
      } finally {
        setIsPostingToLinkedIn(false);
      }
    }
  };

  const handleLinkedInJobSearch = (e) => {
    if (e) e.preventDefault();
    setIsSearchingLinkedIn(true);
    setLinkedInSearchHasSearched(true);
    
    setTimeout(() => {
      const query = linkedInSearchQuery.toLowerCase();
      const loc = linkedInSearchLocation.toLowerCase();
      
      const allMockJobs = [
        {
          id: 'li-res-1',
          title: 'Senior Frontend Engineer (React/Next)',
          company: 'Vercel',
          logoInitials: 'VC',
          logoBg: '#000000',
          location: 'Remote, US',
          salary: '$145,000 - $175,000 / yr',
          posted: '2 days ago',
          type: 'full-time',
          experience: 'mid-senior',
          description: `Vercel is looking for a Senior Frontend Engineer to work on our core dashboard experience.\n\nRole & Responsibilities:\n• Lead architectural decisions for our React and Next.js applications.\n• Collaborate with designers and product managers to create stellar UI/UX.\n• Optimize web application performance for globally distributed users.\n\nRequirements:\n• 5+ years of experience with React, Next.js, and TypeScript.\n• Deep understanding of Webpack, Turbopack, and build systems.\n• Strong eye for detail, design, and web animations.\n• Experience with Tailwind CSS and CSS modules.`,
          requirements: 'React, Next.js, TypeScript, Tailwind CSS, Web Performance'
        },
        {
          id: 'li-res-2',
          title: 'React & React Native Lead',
          company: 'Airbnb',
          logoInitials: 'AB',
          logoBg: '#FF5A5F',
          location: 'Remote, Worldwide',
          salary: '$160,000 - $200,000 / yr',
          posted: '3 days ago',
          type: 'full-time',
          experience: 'mid-senior',
          description: `Join Airbnb as a React/React Native Lead. You will build high-quality mobile and web experiences for guests and hosts worldwide.\n\nKey Responsibilities:\n• Architect cross-platform components in React Native and React.\n• Drive performance improvements and offline-first functionalities.\n• Lead a squad of 6 engineers and run code reviews.\n\nQualifications:\n• 7+ years of experience in JavaScript frameworks, with 4+ years dedicated to React and React Native.\n• Expert at state management (Redux, Zustand, Context API).\n• Strong communicator with track record of leading product initiatives.`,
          requirements: 'React Native, React, Zustand, State Management, Mobile Dev'
        },
        {
          id: 'li-res-3',
          title: 'Staff React Developer (Core UI)',
          company: 'Stripe',
          logoInitials: 'SP',
          logoBg: '#635BFF',
          location: 'San Francisco, CA',
          salary: '$190,000 - $230,000 / yr',
          posted: '1 week ago',
          type: 'full-time',
          experience: 'director',
          description: `Stripe's Core UI team is looking for a Staff Developer to help build the components and design systems powering our dashboard.\n\nWhat You Will Do:\n• Drive the engineering standard of Stripe's web components.\n• Work directly with the Design Systems team to create highly accessible UI.\n• Mentor frontend engineers across the billing, checkout, and connect teams.\n\nRequirements:\n• Expert knowledge of raw browser APIs, rendering engine, accessibility (WCAG).\n• Passion for building reusable library code.\n• 8+ years of production experience.`,
          requirements: 'React, Design Systems, Accessibility (WCAG), Vanilla JS, Webpack'
        },
        {
          id: 'li-res-4',
          title: 'Frontend Engineer (React) - Internship',
          company: 'GitHub',
          logoInitials: 'GH',
          logoBg: '#24292F',
          location: 'San Francisco, CA (Hybrid)',
          salary: '$45 - $60 / hr',
          posted: '1 day ago',
          type: 'internship',
          experience: 'entry',
          description: `GitHub is looking for a Frontend Intern for Fall 2026. You will work on GitHub Copilot dashboard elements and developer community pages.\n\nResponsibilities:\n• Implement new features using React and primer components.\n• Fix UI bugs and optimize page layouts.\n• Learn and apply professional engineering standards under mentorship.\n\nRequirements:\n• Enrolled in a CS or equivalent degree, or boot camp graduate.\n• Proficient in React, JavaScript, and HTML/CSS.\n• Experience with Git and version control.`,
          requirements: 'React, CSS, Git, HTML, JavaScript'
        },
        {
          id: 'li-res-5',
          title: 'Lead Frontend UI Developer',
          company: 'Netflix',
          logoInitials: 'NF',
          logoBg: '#E50914',
          location: 'Los Gatos, CA',
          salary: '$220,000 - $310,000 / yr',
          posted: '4 days ago',
          type: 'full-time',
          experience: 'mid-senior',
          description: `We are looking for a Lead UI Developer for the Netflix TV interface team. You will craft the highly-scalable Web-app rendering on thousands of Smart TV devices.\n\nWhat You Will Do:\n• Lead performance-critical UI rendering improvements.\n• Build fluid 60fps animations on restricted memory environments.\n• Write clean, testable React code.\n\nRequirements:\n• 6+ years in frontend development.\n• Deep React expertise, canvas/WebGL experience is a huge plus.\n• Highly skilled in UI animations and CSS transitions.`,
          requirements: 'React, WebGL, Canvas, Performance Tuning, UI Animations'
        },
        {
          id: 'li-res-6',
          title: 'Contract Full Stack Developer (Node / React)',
          company: 'Figma',
          logoInitials: 'FG',
          logoBg: '#F24E1E',
          location: 'Remote',
          salary: '$90 - $120 / hr',
          posted: '5 days ago',
          type: 'contract',
          experience: 'mid-senior',
          description: `Figma is hiring a Full Stack contractor to help build a custom billing dashboard.\n\nDetails:\n• 6-month contract with possibility of extension.\n• Stack: React, TypeScript, Node.js, PostgreSQL.\n• Focus on data visualization, charts, and invoice exports.\n\nQualifications:\n• 4+ years of full-stack engineering.\n• Experience with Chart.js, D3.js or similar libraries.\n• Self-starter able to deliver end-to-end features.`,
          requirements: 'React, Node.js, TypeScript, PostgreSQL, D3.js'
        },
        {
          id: 'li-res-7',
          title: 'Junior Data Scientist',
          company: 'Meta',
          logoInitials: 'ME',
          logoBg: '#0668E1',
          location: 'Menlo Park, CA',
          salary: '$110,000 - $135,000 / yr',
          posted: '1 day ago',
          type: 'full-time',
          experience: 'entry',
          description: `Join Meta's Product Analytics team as a Junior Data Scientist. You will analyze user engagement patterns for Meta Quest and VR products.\n\nRequirements:\n• Proficiency in Python/R and SQL.\n• Background in statistics, experiment design (A/B testing).\n• Good communication skills and business acumen.`,
          requirements: 'Python, SQL, A/B Testing, Statistics, Excel'
        },
        {
          id: 'li-res-8',
          title: 'Senior Data Scientist (LLM Safety)',
          company: 'OpenAI',
          logoInitials: 'OA',
          logoBg: '#000000',
          location: 'San Francisco, CA (Hybrid)',
          salary: '$240,000 - $330,000 / yr',
          posted: '6 days ago',
          type: 'full-time',
          experience: 'mid-senior',
          description: `OpenAI is seeking a Senior Data Scientist to lead our safety analysis for next-generation generative models.\n\nKey Responsibilities:\n• Design safety evaluations and metrics for LLM models.\n• Conduct fine-tuning and reinforcement learning studies.\n• Inform safety policy via data-driven studies.\n\nQualifications:\n• 5+ years experience in NLP and deep learning models.\n• Expert in PyTorch and Python.\n• Deep research background.`,
          requirements: 'Python, PyTorch, LLMs, NLP, Reinforcement Learning'
        },
        {
          id: 'li-res-9',
          title: 'Technical Product Manager (Payments)',
          company: 'Shopify',
          logoInitials: 'SF',
          logoBg: '#95BF47',
          location: 'Toronto, Canada',
          salary: '$130,000 - $160,000 / yr',
          posted: '5 days ago',
          type: 'full-time',
          experience: 'mid-senior',
          description: `Shopify is seeking a Technical Product Manager to lead our payments integration teams.\n\nKey Responsibilities:\n• Define product roadmap for Shopify Payments core API.\n• Coordinate with credit processors, developers, and compliance teams.\n• Write detailed tech specs and user stories.\n\nQualifications:\n• 4+ years of product management, with 2+ years in Fintech.\n• Basic SQL and coding capabilities to communicate effectively with engineering.`,
          requirements: 'Product Management, Fintech, Payments, SQL, Agile'
        }
      ];

      let filtered = allMockJobs.filter(job => {
        const matchQuery = !query || 
          job.title.toLowerCase().includes(query) || 
          job.company.toLowerCase().includes(query) || 
          job.requirements.toLowerCase().includes(query);
          
        const matchLoc = !loc || job.location.toLowerCase().includes(loc) || (loc === 'remote' && job.location.toLowerCase().includes('remote'));
        const matchType = linkedInSearchJobType === 'all' || job.type === linkedInSearchJobType;
        const matchExp = linkedInSearchExperience === 'all' || job.experience === linkedInSearchExperience;
        
        return matchQuery && matchLoc && matchType && matchExp;
      });
      
      if (filtered.length === 0) {
        // Generate dynamic mock jobs matching their query
        const capitalizedQuery = query.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const locations = [linkedInSearchLocation || 'Remote, Global', 'San Francisco, CA', 'New York, NY', 'Bangalore, India'];
        const companies = ['Meta', 'Google', 'Microsoft', 'Netflix', 'Amazon', 'Vercel', 'Uber'];
        const colors = ['#0668E1', '#4285F4', '#F25022', '#E50914', '#FF9900', '#000000', '#00A4EF'];
        
        filtered = Array.from({ length: 3 }).map((_, i) => {
          const companyIdx = Math.floor(Math.random() * companies.length);
          const comp = companies[companyIdx];
          const logoInitials = comp.substring(0, 2).toUpperCase();
          const logoBg = colors[companyIdx];
          const location = locations[i % locations.length];
          const salary = `$${100 + i * 20},000 - $${130 + i * 30},000 / yr`;
          const type = linkedInSearchJobType === 'all' ? 'full-time' : linkedInSearchJobType;
          const experience = linkedInSearchExperience === 'all' ? 'mid-senior' : linkedInSearchExperience;
          
          return {
            id: `li-dynamic-${Date.now()}-${i}`,
            title: `${capitalizedQuery || 'Software Specialist'} (${experience === 'entry' ? 'Junior' : experience === 'director' ? 'Lead/Director' : 'Senior'})`,
            company: comp,
            logoInitials,
            logoBg,
            location,
            salary,
            posted: 'Just now',
            type,
            experience,
            description: `We are looking for a qualified ${capitalizedQuery || 'Software Specialist'} to join the team at ${comp}.\n\nRequirements:\n• 3+ years experience with key industry frameworks.\n• Strong collaboration skills.\n• Bachelor's degree or equivalent experience in computer science or related field.`,
            requirements: `${capitalizedQuery || 'Engineering'}, JavaScript, Git`
          };
        });
      }
      
      setLinkedInSearchResults(filtered);
      setIsSearchingLinkedIn(false);
    }, 1200);
  };

  const handleSyncMetrics = (postId) => {
    setLinkedInPostHistory(prev => {
      const updated = prev.map(p => {
        if (p.id === postId) {
          const addedViews = Math.floor(Math.random() * 50) + 10;
          const addedClicks = Math.floor(addedViews * (Math.random() * 0.3 + 0.05));
          const addedApplies = Math.floor(addedClicks * (Math.random() * 0.2));
          return {
            ...p,
            views: p.views + addedViews,
            clicks: p.clicks + addedClicks,
            applies: p.applies + addedApplies
          };
        }
        return p;
      });
      localStorage.setItem('rp_linkedin_post_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleClosePost = (postId) => {
    setLinkedInPostHistory(prev => {
      const updated = prev.map(p => {
        if (p.id === postId) {
          return { ...p, status: 'Archived' };
        }
        return p;
      });
      localStorage.setItem('rp_linkedin_post_history', JSON.stringify(updated));
      return updated;
    });
  };

  const renderLinkedInView = () => {
    return (
      <div className="linkedin-portal-panel animate-fade-in">
        <div className="view-header">
          <h2>LinkedIn Integration Portal</h2>
          <p className="subtitle">Publish active ATS jobs directly to LinkedIn feeds and search external listings to import.</p>
        </div>

        {linkedInMode === 'sandbox' && (
          <div className="integration-status-banner animate-fade-in" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1rem 1.2rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-gold-light)',
            border: '1px solid var(--color-gold)',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            color: 'var(--color-ink-light)'
          }}>
            <AlertTriangle size={18} style={{ color: 'var(--color-gold)', flexShrink: 0 }} />
            <div style={{ flex: 1, lineHeight: '1.4' }}>
              <strong>Sandbox Mode Active:</strong> Job postings and search results are simulated inside the local ATS database for testing. Clicking <em>"View Post"</em> redirects you to your actual feed dashboard. To connect and publish to a live LinkedIn profile feed, toggle to <strong>Live API Mode</strong> under the <em>Settings</em> tab.
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="linkedin-tab-bar">
          <button 
            type="button"
            className={`linkedin-tab-btn ${linkedinActiveTab === 'post' ? 'active' : ''}`}
            onClick={() => setLinkedinActiveTab('post')}
          >
            <Share2 size={16} /> Job Posting & Feed Preview
          </button>
          <button 
            type="button"
            className={`linkedin-tab-btn ${linkedinActiveTab === 'search' ? 'active' : ''}`}
            onClick={() => setLinkedinActiveTab('search')}
          >
            <Search size={16} /> Job Search & Import
          </button>
          <button 
            type="button"
            className={`linkedin-tab-btn ${linkedinActiveTab === 'settings' ? 'active' : ''}`}
            onClick={() => setLinkedinActiveTab('settings')}
          >
            <Settings size={16} /> Connection & API Settings
          </button>
        </div>

        {/* Render Settings Tab */}
        {linkedinActiveTab === 'settings' && (
          <div className="linkedin-settings-view">
            <div className="linkedin-card card">
              <h3 className="card-title">LinkedIn API Integration Config</h3>
              
              <div className="integration-status-banner" style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1.2rem', borderRadius: 'var(--radius-md)',
                backgroundColor: linkedInConnected ? 'var(--color-sage-light)' : 'var(--color-gold-light)',
                border: `1px solid ${linkedInConnected ? 'var(--color-sage)' : 'var(--color-gold)'}`,
                marginBottom: '2rem'
              }}>
                {linkedInConnected ? <CheckCircle size={24} style={{ color: 'var(--color-sage)' }} /> : <AlertTriangle size={24} style={{ color: 'var(--color-gold)' }} />}
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: 'var(--color-ink)', fontSize: '1rem', fontWeight: 'bold' }}>
                    {linkedInConnected ? 'LinkedIn Account Connected' : 'LinkedIn Authorization Required'}
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-light)', marginTop: '0.2rem' }}>
                    {linkedInConnected 
                      ? `Authorized as ${linkedInProfile?.name || 'Recruiter'}. Ready to post jobs and search listings.` 
                      : 'Please authorize with your LinkedIn Credentials to enable live posting feeds.'}
                  </p>
                </div>
                {!linkedInConnected ? (
                  <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={handleAuthorizeLinkedIn}
                  >
                    Authorize Account
                  </button>
                ) : (
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => {
                      setLinkedInConnected(false);
                      setLinkedInProfile(null);
                    }}
                    style={{ color: 'var(--color-red)', borderColor: 'var(--color-red)' }}
                  >
                    Disconnect
                  </button>
                )}
              </div>

              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Client ID</label>
                  <input 
                    type="text" 
                    className="input-text" 
                    placeholder="Enter Client ID from Developer Portal"
                    value={linkedInClientId}
                    onChange={(e) => setLinkedInClientId(e.target.value)}
                    disabled={linkedInConnected}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Client Secret</label>
                  <input 
                    type="password" 
                    className="input-text" 
                    placeholder="Enter Client Secret"
                    value={linkedInClientSecret}
                    onChange={(e) => setLinkedInClientSecret(e.target.value)}
                    disabled={linkedInConnected}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">OAuth Redirect URI</label>
                <input 
                  type="text" 
                  className="input-text" 
                  value={linkedInRedirectUri}
                  onChange={(e) => setLinkedInRedirectUri(e.target.value)}
                  disabled={linkedInConnected}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label className="form-label">
                  LinkedIn Access Token 
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)', fontWeight: 'normal', marginLeft: '0.4rem' }}>
                    (Required for Live API Mode posting)
                  </span>
                </label>
                <input 
                  type="password" 
                  className="input-text" 
                  placeholder="Paste your OAuth Access Token (Bearer token)"
                  value={linkedInAccessToken}
                  onChange={(e) => setLinkedInAccessToken(e.target.value)}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)', marginTop: '0.3rem' }}>
                  Provide a token with <code>w_member_social</code> scope. You can generate one using the LinkedIn OAuth Tools or developer portal.
                </p>
              </div>

              <div className="form-group" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Integration Execution Mode</span>
                  <span className={`badge ${linkedInMode === 'sandbox' ? 'badge-gold' : 'badge-sage'}`} style={{
                    padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', textTransform: 'uppercase',
                    backgroundColor: linkedInMode === 'sandbox' ? 'var(--color-gold-light)' : 'var(--color-sage-light)',
                    color: linkedInMode === 'sandbox' ? 'var(--color-gold)' : 'var(--color-sage)',
                    border: `1px solid ${linkedInMode === 'sandbox' ? 'var(--color-gold)' : 'var(--color-sage)'}`
                  }}>
                    {linkedInMode} mode
                  </span>
                </label>
                
                <div className="mode-toggle-options" style={{ display: 'flex', gap: '1rem', marginTop: '0.8rem' }}>
                  <label className="mode-label" style={{
                    flex: 1, padding: '1rem', border: `1px solid ${linkedInMode === 'sandbox' ? 'var(--color-terracotta)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', gap: '0.8rem', alignItems: 'flex-start',
                    backgroundColor: linkedInMode === 'sandbox' ? 'var(--color-ink-tint)' : 'transparent'
                  }}>
                    <input 
                      type="radio" 
                      name="linkedinMode" 
                      checked={linkedInMode === 'sandbox'} 
                      onChange={() => setLinkedInMode('sandbox')}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <div style={{ fontWeight: 'bold', color: 'var(--color-ink)', fontSize: '0.9rem' }}>Sandbox (Simulated)</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginTop: '0.2rem' }}>
                        Allows instant testing with realistic mock data, OAuth simulation popup, and analytics metrics without requiring enterprise API credentials.
                      </div>
                    </div>
                  </label>

                  <label className="mode-label" style={{
                    flex: 1, padding: '1rem', border: `1px solid ${linkedInMode === 'live' ? 'var(--color-terracotta)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', gap: '0.8rem', alignItems: 'flex-start',
                    backgroundColor: linkedInMode === 'live' ? 'var(--color-ink-tint)' : 'transparent'
                  }}>
                    <input 
                      type="radio" 
                      name="linkedinMode" 
                      checked={linkedInMode === 'live'} 
                      onChange={() => setLinkedInMode('live')}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <div style={{ fontWeight: 'bold', color: 'var(--color-ink)', fontSize: '0.9rem' }}>Live API Mode</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginTop: '0.2rem' }}>
                        Connect to real LinkedIn API endpoints. Requires verified Developer application credentials and server-side token handlers.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="linkedin-card card" style={{ marginTop: '1.5rem' }}>
              <h3 className="card-title">Setup Guidelines</h3>
              <ol style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.85rem', color: 'var(--color-ink-light)', marginTop: '1rem' }}>
                <li>Go to the <a href="https://www.linkedin.com/developers/" target="_blank" rel="noreferrer" style={{ fontWeight: 'bold' }}>LinkedIn Developers Portal</a> and create an application.</li>
                <li>Request permissions for <strong>Share on LinkedIn</strong> or <strong>Sign In with LinkedIn</strong> under the "Products" tab.</li>
                <li>Add your Redirect URI (<code>{linkedInRedirectUri}</code>) under Authorized Redirect URLs in OAuth 2.0 settings.</li>
                <li>Copy the Client ID and Client Secret into the settings inputs above.</li>
                <li>Click <strong>Authorize Account</strong> to link your recruiter profile!</li>
              </ol>
            </div>
          </div>
        )}

        {/* Render Posting Tab */}
        {linkedinActiveTab === 'post' && (
          <div className="linkedin-post-view">
            <div className="linkedin-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'flex-start' }}>
              {/* Configuration panel */}
              <div className="linkedin-card card">
                <h3 className="card-title">Configure LinkedIn Job Post</h3>
                
                <div className="form-group" style={{ marginTop: '1.2rem' }}>
                  <label className="form-label">Select Job to Post</label>
                  <select 
                    className="input-text" 
                    value={selectedJobForLinkedIn}
                    onChange={(e) => setSelectedJobForLinkedIn(e.target.value)}
                  >
                    {jobs.map(job => (
                      <option key={job.id} value={job.id}>{job.title}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Post Destination</label>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <button 
                      type="button" 
                      className={`btn-secondary ${linkedInPostType === 'member' ? 'active' : ''}`}
                      onClick={() => setLinkedInPostType('member')}
                      style={{ flex: 1, backgroundColor: linkedInPostType === 'member' ? 'var(--color-ink-tint)' : 'transparent', borderColor: linkedInPostType === 'member' ? 'var(--color-terracotta)' : 'var(--color-border)' }}
                    >
                      Personal Feed
                    </button>
                    <button 
                      type="button" 
                      className={`btn-secondary ${linkedInPostType === 'company' ? 'active' : ''}`}
                      onClick={() => setLinkedInPostType('company')}
                      style={{ flex: 1, backgroundColor: linkedInPostType === 'company' ? 'var(--color-ink-tint)' : 'transparent', borderColor: linkedInPostType === 'company' ? 'var(--color-terracotta)' : 'var(--color-border)' }}
                    >
                      Company Page
                    </button>
                  </div>
                </div>

                {linkedInPostType === 'company' && (
                  <div className="form-group animate-fade-in">
                    <label className="form-label">LinkedIn Company URN ID</label>
                    <input 
                      type="text" 
                      className="input-text" 
                      placeholder="e.g. 13245678"
                      value={linkedInCompanyId}
                      onChange={(e) => setLinkedInCompanyId(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Share Text Content</label>
                  <textarea 
                    className="input-textarea" 
                    value={linkedInShareText}
                    onChange={(e) => setLinkedInShareText(e.target.value)}
                    rows={8}
                    placeholder="Enter the post body..."
                    style={{ fontSize: '0.85rem', lineHeight: '1.4' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-ink-muted)', marginTop: '0.3rem' }}>
                    <span>Auto-formatted from active job specification</span>
                    <span>{linkedInShareText.length} / 3000 chars</span>
                  </div>
                </div>

                {linkedInPostSuccess && (
                  <div style={{
                    padding: '0.8rem 1rem', backgroundColor: 'var(--color-sage-light)',
                    border: '1px solid var(--color-sage)', borderRadius: 'var(--radius-sm)',
                    marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem'
                  }}>
                    <span style={{ color: 'var(--color-sage)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                      🎉 Job Post Published Successfully!
                    </span>
                    {linkedInMode === 'sandbox' ? (
                      <button 
                        type="button" 
                        onClick={() => {
                          alert(`ℹ️ RecruiterPro Sandbox Mode:\n\nThis is a simulated job posting stored in the ATS local database. Live feeds on LinkedIn.com are disabled in Sandbox Mode.\n\nTo view your actual LinkedIn feed, we will now redirect you to: https://www.linkedin.com/feed/`);
                          window.open('https://www.linkedin.com/feed/', '_blank');
                        }}
                        style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', color: 'var(--color-terracotta)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', textAlign: 'left' }}
                      >
                        View Live Post on LinkedIn <ExternalLink size={12} />
                      </button>
                    ) : (
                      <a href={linkedInShareUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--color-terracotta)', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        View Live Post on LinkedIn <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                )}

                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={handlePostToLinkedIn}
                  disabled={isPostingToLinkedIn || jobs.length === 0}
                  style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.8rem' }}
                >
                  {isPostingToLinkedIn ? (
                    <>
                      <div className="spinner-mini" style={{ width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Publishing Job Post...
                    </>
                  ) : (
                    <>
                      <Share2 size={16} /> Publish to LinkedIn
                    </>
                  )}
                </button>
              </div>

              {/* Feed preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--color-ink-muted)', fontWeight: 'bold' }}>
                  LinkedIn Feed Preview
                </h4>
                
                <div className="linkedin-feed-preview" style={{
                  backgroundColor: 'var(--color-paper-light)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.2rem',
                  boxShadow: 'var(--shadow-md)'
                }}>
                  {/* Preview header */}
                  <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%',
                      backgroundColor: 'var(--color-terracotta)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', fontSize: '1.1rem'
                    }}>
                      {linkedInConnected ? (linkedInProfile?.name || 'AD').substring(0, 2).toUpperCase() : 'RP'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--color-ink)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {linkedInConnected ? (linkedInProfile?.name || 'Recruiter') : 'RecruiterPro ATS'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {linkedInConnected ? (linkedInProfile?.headline || 'Talent Acquisition Lead') : 'ATS Integration'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-ink-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.1rem' }}>
                        <span>Just now</span>
                        <span>•</span>
                        <span>🌐</span>
                      </div>
                    </div>
                  </div>

                  {/* Preview text */}
                  <p style={{
                    fontSize: '0.85rem', color: 'var(--color-ink)',
                    whiteSpace: 'pre-line', margin: '0 0 1rem 0',
                    lineHeight: '1.4'
                  }}>
                    {linkedInShareText || 'Post content will appear here when you select an active job...'}
                  </p>

                  {/* Preview job attachment card */}
                  {jobs.find(j => j.id === selectedJobForLinkedIn) && (
                    <div className="preview-job-attachment" style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      backgroundColor: 'var(--color-paper)'
                    }}>
                      <div style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{
                          width: '48px', height: '48px', borderRadius: '4px',
                          backgroundColor: 'var(--color-terracotta-light)', color: 'var(--color-terracotta)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 'bold', fontSize: '1rem', flexShrink: 0
                        }}>
                          JO
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h5 style={{ fontWeight: 'bold', color: 'var(--color-ink)', fontSize: '0.9rem', margin: 0 }}>
                            {jobs.find(j => j.id === selectedJobForLinkedIn)?.title}
                          </h5>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)', margin: '0.1rem 0 0 0' }}>
                            RecruiterPro ATS • Remote
                          </p>
                        </div>
                      </div>
                      <div style={{
                        borderTop: '1px solid var(--color-border)',
                        padding: '0.6rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        backgroundColor: 'var(--color-paper-darker)'
                      }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-sage)', fontWeight: 'bold' }}>
                          ⚡ Easy Apply
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>
                          linkedin.com
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Posting History Table */}
            <div className="linkedin-card card" style={{ marginTop: '2rem' }}>
              <h3 className="card-title" style={{ marginBottom: '1.2rem' }}>Active LinkedIn Listings & Analytics</h3>
              
              <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <table className="candidate-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)', color: 'var(--color-ink-muted)' }}>
                      <th style={{ padding: '0.8rem' }}>Job Posting</th>
                      <th style={{ padding: '0.8rem' }}>Destination</th>
                      <th style={{ padding: '0.8rem' }}>Date Posted</th>
                      <th style={{ padding: '0.8rem' }}>Status</th>
                      <th style={{ padding: '0.8rem', textAlign: 'center' }}>Views</th>
                      <th style={{ padding: '0.8rem', textAlign: 'center' }}>Clicks</th>
                      <th style={{ padding: '0.8rem', textAlign: 'center' }}>Applies</th>
                      <th style={{ padding: '0.8rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedInPostHistory.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
                          No jobs posted to LinkedIn yet. Select a job above to post.
                        </td>
                      </tr>
                    ) : (
                      linkedInPostHistory.map(post => (
                        <tr key={post.id} style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-ink-light)' }}>
                          <td style={{ padding: '0.8rem', fontWeight: 'bold', color: 'var(--color-ink)' }}>
                            {post.jobTitle}
                          </td>
                          <td style={{ padding: '0.8rem' }}>
                            <span style={{ textTransform: 'capitalize' }}>{post.postType} feed</span>
                          </td>
                          <td style={{ padding: '0.8rem' }}>{post.postedAt}</td>
                          <td style={{ padding: '0.8rem' }}>
                            <span className={`badge ${post.status === 'Live' ? 'badge-sage' : 'badge-gold'}`} style={{
                              padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                              backgroundColor: post.status === 'Live' ? 'var(--color-sage-light)' : 'var(--color-paper-darker)',
                              color: post.status === 'Live' ? 'var(--color-sage)' : 'var(--color-ink-muted)',
                              border: `1px solid ${post.status === 'Live' ? 'var(--color-sage)' : 'var(--color-border)'}`
                            }}>
                              {post.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.8rem', textAlign: 'center', fontWeight: 'bold' }}>{post.views}</td>
                          <td style={{ padding: '0.8rem', textAlign: 'center', fontWeight: 'bold' }}>{post.clicks}</td>
                          <td style={{ padding: '0.8rem', textAlign: 'center', fontWeight: 'bold', color: 'var(--color-sage)' }}>{post.applies}</td>
                          <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                              {linkedInMode === 'sandbox' ? (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                  onClick={() => {
                                    alert(`ℹ️ RecruiterPro Sandbox Mode:\n\nThis is a simulated job posting stored in the ATS local database. Live feeds on LinkedIn.com are disabled in Sandbox Mode.\n\nTo view your actual LinkedIn feed, we will now redirect you to: https://www.linkedin.com/feed/`);
                                    window.open('https://www.linkedin.com/feed/', '_blank');
                                  }}
                                >
                                  View <ExternalLink size={12} />
                                </button>
                              ) : (
                                <a 
                                  href={post.shareUrl} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="btn-secondary" 
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                >
                                  View <ExternalLink size={12} />
                                </a>
                              )}
                              {post.status === 'Live' && (
                                <>
                                  <button 
                                    type="button" 
                                    className="btn-secondary" 
                                    onClick={() => handleSyncMetrics(post.id)}
                                    title="Fetch latest views & applies from LinkedIn"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                  >
                                    <RefreshCw size={12} /> Sync
                                  </button>
                                  <button 
                                    type="button" 
                                    className="btn-secondary" 
                                    onClick={() => handleClosePost(post.id)}
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--color-red)' }}
                                  >
                                    Close
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Render Search Tab */}
        {linkedinActiveTab === 'search' && (
          <div className="linkedin-search-view">
            {/* Search Filters Card */}
            <div className="linkedin-card card" style={{ marginBottom: '1.5rem' }}>
              <h3 className="card-title">Search Jobs on LinkedIn</h3>
              
              <form onSubmit={handleLinkedInJobSearch} style={{ marginTop: '1.2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label text-xs">Keywords</label>
                    <input 
                      type="text" 
                      className="input-text text-sm" 
                      placeholder="e.g. React Developer"
                      value={linkedInSearchQuery}
                      onChange={(e) => setLinkedInSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label text-xs">Location</label>
                    <input 
                      type="text" 
                      className="input-text text-sm" 
                      placeholder="e.g. Remote / New York"
                      value={linkedInSearchLocation}
                      onChange={(e) => setLinkedInSearchLocation(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label text-xs">Job Type</label>
                    <select 
                      className="input-text text-sm"
                      value={linkedInSearchJobType}
                      onChange={(e) => setLinkedInSearchJobType(e.target.value)}
                    >
                      <option value="all">All Types</option>
                      <option value="full-time">Full-Time</option>
                      <option value="part-time">Part-Time</option>
                      <option value="contract">Contract</option>
                      <option value="internship">Internship</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label text-xs">Experience Level</label>
                    <select 
                      className="input-text text-sm"
                      value={linkedInSearchExperience}
                      onChange={(e) => setLinkedInSearchExperience(e.target.value)}
                    >
                      <option value="all">All Experience Levels</option>
                      <option value="entry">Entry Level</option>
                      <option value="mid-senior">Mid-Senior Level</option>
                      <option value="director">Director / Executive</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      type="submit" 
                      className="btn-primary" 
                      disabled={isSearchingLinkedIn}
                      style={{ height: '38px', padding: '0 1.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      {isSearchingLinkedIn ? (
                        <div className="spinner-mini" style={{ width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      ) : (
                        <Search size={16} />
                      )}
                      Search
                    </button>
                    
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      onClick={() => {
                        const keywords = linkedInSearchQuery || '';
                        const location = linkedInSearchLocation || '';
                        const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}`;
                        window.open(url, '_blank');
                      }}
                      style={{ height: '38px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderStyle: 'dashed' }}
                      title="Search directly on real LinkedIn.com"
                    >
                      <ExternalLink size={14} /> Live Search
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Results Section */}
            {isSearchingLinkedIn ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 0', gap: '1rem' }}>
                <div className="spinner-large" style={{ width: '40px', height: '40px', border: '3px solid var(--color-terracotta)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.9rem' }}>Querying LinkedIn API endpoints...</p>
              </div>
            ) : !linkedInSearchHasSearched ? (
              <div className="linkedin-card card" style={{ padding: '4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '1rem', backgroundColor: 'var(--color-terracotta-light)', borderRadius: '50%', color: 'var(--color-terracotta)' }}>
                  <Linkedin size={36} />
                </div>
                <h4 style={{ fontSize: '1.2rem', color: 'var(--color-ink)' }}>Search External Opportunities</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-ink-muted)', maxWidth: '400px' }}>
                  Search for jobs directly on LinkedIn and pull them into RecruiterPro with a single click to start screening and tracking candidate applications.
                </p>
              </div>
            ) : linkedInSearchResults.length === 0 ? (
              <div className="linkedin-card card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
                No search results found. Try adjusting keywords or location search queries.
              </div>
            ) : (
              <div className="linkedin-search-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                {linkedInSearchResults.map(job => (
                  <div key={job.id} className="linkedin-job-card card" style={{
                    display: 'flex', flexDirection: 'column', height: '100%',
                    justifyContent: 'space-between', padding: '1.2rem', transition: 'var(--transition-smooth)'
                  }}>
                    <div>
                      {/* Logo and Score */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '4px',
                          backgroundColor: job.logoBg, color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 'bold', fontSize: '0.9rem'
                        }}>
                          {job.logoInitials}
                        </div>
                        <span className="badge badge-sage" style={{
                          fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)',
                          backgroundColor: 'var(--color-sage-light)', color: 'var(--color-sage)', border: '1px solid var(--color-sage)'
                        }}>
                          98% ATS Match
                        </span>
                      </div>

                      {/* Title and Company */}
                      <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--color-ink)', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={job.title}>
                        {job.title}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', fontWeight: '500' }}>
                        {job.company} • {job.location}
                      </p>

                      <p style={{
                        fontSize: '0.8rem', color: 'var(--color-ink-light)', marginTop: '0.8rem',
                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.4'
                      }}>
                        {job.description.split('\n')[0]}
                      </p>
                    </div>

                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginTop: '1.2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-ink)' }}>{job.salary}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>{job.posted}</span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          type="button" 
                          className="btn-secondary" 
                          onClick={() => setSelectedSearchResult(job)}
                          style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                        >
                          View Details
                        </button>
                        <button 
                          type="button" 
                          className="btn-primary" 
                          onClick={() => handleImportLinkedInJob(job)}
                          style={{ flex: 1.2, fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}
                        >
                          <Download size={14} /> Import to ATS
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderLinkedInJobDetailsModal = () => {
    if (!selectedSearchResult) return null;
    const job = selectedSearchResult;

    return (
      <div className="modal-backdrop">
        <div className="modal-content" style={{ maxWidth: '650px', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-header">
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '4px',
                backgroundColor: job.logoBg, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: '1rem'
              }}>
                {job.logoInitials}
              </div>
              <div>
                <h3 className="modal-title" style={{ fontSize: '1.2rem' }}>{job.title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)', margin: 0 }}>
                  {job.company} • {job.location} • {job.type}
                </p>
              </div>
            </div>
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setSelectedSearchResult(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-light)' }}
            >
              <X size={18} />
            </button>
          </div>

          <div className="modal-body" style={{ overflowY: 'auto', padding: '1.5rem', flex: 1 }}>
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)', display: 'block' }}>Salary Range</span>
                <strong style={{ color: 'var(--color-ink)', fontSize: '0.95rem' }}>{job.salary}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)', display: 'block' }}>Experience Level</span>
                <strong style={{ color: 'var(--color-ink)', fontSize: '0.95rem', textTransform: 'capitalize' }}>{job.experience} level</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)', display: 'block' }}>Posted Date</span>
                <strong style={{ color: 'var(--color-ink)', fontSize: '0.95rem' }}>{job.posted}</strong>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--color-ink)', marginBottom: '0.5rem' }}>
                Extracted Skills (Must-Haves)
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {job.requirements.split(',').map((req, i) => (
                  <span key={i} style={{
                    fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-ink-tint)', border: '1px solid var(--color-border)', color: 'var(--color-ink-light)'
                  }}>
                    {req.trim()}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--color-ink)', marginBottom: '0.5rem' }}>
                Detailed Job Description
              </h4>
              <p style={{
                fontSize: '0.85rem', color: 'var(--color-ink-light)',
                whiteSpace: 'pre-line', lineHeight: '1.5'
              }}>
                {job.description}
              </p>
            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid var(--color-border)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: 'var(--color-paper-darker)' }}>
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => setSelectedSearchResult(null)}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="btn-primary" 
              onClick={() => handleImportLinkedInJob(job)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <Download size={14} /> Import into Jobs Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLinkedInAuthModal = () => {
    if (!isLinkedInAuthOpen) return null;

    const handleLogin = (e) => {
      e.preventDefault();
      setAuthStep('consent');
    };

    const handleConsent = () => {
      setAuthStep('processing');
      setTimeout(() => {
        setLinkedInConnected(true);
        setLinkedInProfile({
          name: 'Alex Rivera',
          headline: 'Talent Acquisition Lead at RecruiterPro Inc.',
          avatar: 'AR',
          id: 'li-user-128374'
        });
        setAuthStep('success');
        setTimeout(() => {
          setIsLinkedInAuthOpen(false);
          setAuthStep('login');
        }, 1200);
      }, 1500);
    };

    return (
      <div className="modal-backdrop" style={{ zIndex: 9999 }}>
        <div className="modal-content" style={{ maxWidth: '420px', padding: '1.8rem', borderRadius: 'var(--radius-lg)' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0077b5' }}>
              <Linkedin size={24} />
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '-0.02em' }}>LinkedIn Authorization</span>
            </div>
            {authStep !== 'processing' && authStep !== 'success' && (
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => {
                  setIsLinkedInAuthOpen(false);
                  setAuthStep('login');
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-light)' }}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Login Step */}
          {authStep === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '1.05rem', color: 'var(--color-ink)' }}>Sign in with LinkedIn</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginTop: '0.2rem' }}>
                  Authorize RecruiterPro ATS to link with your account.
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label text-xs">LinkedIn User Email</label>
                <input 
                  type="email" 
                  className="input-text text-sm" 
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label text-xs">Password</label>
                <input 
                  type="password" 
                  className="input-text text-sm" 
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required 
                />
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: '100%', padding: '0.7rem', backgroundColor: '#0077b5', borderColor: '#0077b5', marginTop: '0.5rem' }}
              >
                Sign In
              </button>
            </form>
          )}

          {/* Consent Step */}
          {authStep === 'consent' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', margin: '0.8rem 0' }}>
                <div style={{
                  width: '50px', height: '50px', borderRadius: '10px',
                  backgroundColor: 'var(--color-terracotta)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold', fontSize: '1.1rem', boxShadow: 'var(--shadow-sm)'
                }}>
                  RP
                </div>
                <div style={{ fontSize: '1.5rem', color: 'var(--color-ink-muted)' }}>⇄</div>
                <div style={{
                  width: '50px', height: '50px', borderRadius: '10px',
                  backgroundColor: '#0077b5', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold', fontSize: '1.3rem', boxShadow: 'var(--shadow-sm)'
                }}>
                  in
                </div>
              </div>

              <h4 style={{ fontSize: '1.05rem', color: 'var(--color-ink)' }}>Access Request</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-light)', lineHeight: '1.4', textAlign: 'left' }}>
                <strong>RecruiterPro ATS</strong> is requesting permission to access your LinkedIn account details:
              </p>
              
              <ul style={{
                textAlign: 'left', paddingLeft: '1.2rem', fontSize: '0.8rem',
                color: 'var(--color-ink-muted)', display: 'flex', flexDirection: 'column', gap: '0.4rem'
              }}>
                <li>Use your profile name, headline, and profile avatar info.</li>
                <li>Post job updates and links directly to your LinkedIn personal feed.</li>
                <li>Access and post updates on behalf of your connected Company Pages.</li>
              </ul>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.8rem' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setAuthStep('login')}
                  style={{ flex: 1, padding: '0.6rem' }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={handleConsent}
                  style={{ flex: 1.5, padding: '0.6rem', backgroundColor: '#0077b5', borderColor: '#0077b5' }}
                >
                  Allow & Connect
                </button>
              </div>
            </div>
          )}

          {/* Processing Step */}
          {authStep === 'processing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0', gap: '1.2rem' }}>
              <div className="spinner-large" style={{ width: '36px', height: '36px', border: '3px solid #0077b5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)', margin: 0 }}>
                Authenticating credentials and fetching token...
              </p>
            </div>
          )}

          {/* Success Step */}
          {authStep === 'success' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0', gap: '1rem', textAlign: 'center' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                backgroundColor: 'var(--color-sage-light)', color: 'var(--color-sage)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.8rem', border: '2px solid var(--color-sage)'
              }}>
                ✓
              </div>
              <h4 style={{ fontSize: '1.05rem', color: 'var(--color-ink)' }}>Connection Complete!</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', margin: 0 }}>
                Account successfully connected to RecruiterPro.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!session) {
    return renderLoginScreen();
  }

  if (userRole !== 'admin') {
    try {
      return renderCandidateDashboard();
    } catch (err) {
      console.error("CRASH IN CANDIDATE DASHBOARD:", err);
      return (
        <div style={{ padding: '2rem', background: '#fff', color: '#f00', overflow: 'auto', height: '100vh', fontFamily: 'monospace' }}>
          <h2>Candidate Dashboard Rendering Error:</h2>
          <pre>{err.stack || err.message || err.toString()}</pre>
        </div>
      );
    }
  }

  return (
    <div className="app-container">
      {renderLeftSidebar()}
      <div className="main-workspace">
        {renderTopHeader()}
        <div className="workspace-content">
          {activeSidebarTab === 'jobs' && renderJobsView()}
          {activeSidebarTab === 'candidates' && renderCandidatesView()}
          {activeSidebarTab === 'linkedin' && renderLinkedInView()}
          {activeSidebarTab === 'careers' && renderCareersView()}
          {activeSidebarTab === 'templates' && renderTemplatesView()}
          {activeSidebarTab === 'settings' && renderSettingsView()}
        </div>
      </div>

      {renderProfileDrawer()}
      {renderAIAssistant()}
      {renderCandidateAuthModal()}
      {renderCareersPreviewModal()}
      {renderCreateJobModal()}
      {renderSupabaseModal()}
      {renderLinkedInJobDetailsModal()}
      {renderLinkedInAuthModal()}

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

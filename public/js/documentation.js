/**
 * Documentation Page Module
 * Handles loading and rendering of backend architecture documentation
 */

// ============================================================
// MARKDOWN TO HTML CONVERTER
// ============================================================

function convertMarkdownToHTML(markdown) {
  // Process line by line to handle structure properly
  const lines = markdown.split('\n');
  let processedLines = [];
  let inCodeBlock = false;
  let codeBlockContent = [];
  let codeBlockLang = '';
  let inMermaidBlock = false;
  let mermaidContent = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Handle code blocks first (they can span multiple lines)
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      
      if (inCodeBlock) {
        // Close code block
        const code = codeBlockContent.join('\n');
        if (codeBlockLang === 'mermaid') {
          processedLines.push(`<div class="mermaid-diagram">${code}</div>`);
        } else {
          processedLines.push(`<pre class="code-block"><code class="language-${codeBlockLang}">${escapeHtml(code.trim())}</code></pre>`);
        }
        codeBlockContent = [];
        codeBlockLang = '';
        inCodeBlock = false;
        inMermaidBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
        codeBlockLang = lang.toLowerCase();
        inMermaidBlock = codeBlockLang === 'mermaid';
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }
    
    // Process non-code-block lines
    const trimmed = line.trim();
    
    // Empty lines
    if (trimmed === '') {
      processedLines.push('');
      continue;
    }
    
    // Headers (process before other formatting)
    if (trimmed.match(/^#### /)) {
      processedLines.push(`<h4>${trimmed.slice(5)}</h4>`);
      continue;
    }
    if (trimmed.match(/^### /)) {
      processedLines.push(`<h3>${trimmed.slice(4)}</h3>`);
      continue;
    }
    if (trimmed.match(/^## /)) {
      processedLines.push(`<h2>${trimmed.slice(3)}</h2>`);
      continue;
    }
    if (trimmed.match(/^# /)) {
      processedLines.push(`<h1>${trimmed.slice(2)}</h1>`);
      continue;
    }
    
    // Horizontal rule
    if (trimmed.match(/^-{3,}$/)) {
      processedLines.push('<hr>');
      continue;
    }
    
    // Store raw line for list processing
    processedLines.push(line);
  }
  
  // Close any open code block
  if (inCodeBlock) {
    const code = codeBlockContent.join('\n');
    if (codeBlockLang === 'mermaid') {
      processedLines.push(`<div class="mermaid-diagram">${code}</div>`);
    } else {
      processedLines.push(`<pre class="code-block"><code class="language-${codeBlockLang}">${escapeHtml(code.trim())}</code></pre>`);
    }
  }
  
  // Now process lists and paragraphs
  html = processedLines.join('\n');
  const finalLines = html.split('\n');
  let finalProcessed = [];
  let inList = false;
  let listType = null;
  
  for (let i = 0; i < finalLines.length; i++) {
    let line = finalLines[i];
    const trimmed = line.trim();
    
    // Skip empty lines (close lists)
    if (trimmed === '') {
      if (inList) {
        finalProcessed.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
        listType = null;
      }
      finalProcessed.push('');
      continue;
    }
    
    // Skip already-processed HTML (headers, code blocks, etc.)
    if (trimmed.startsWith('<')) {
      if (inList) {
        finalProcessed.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
        listType = null;
      }
      finalProcessed.push(line);
      continue;
    }
    
    // Unordered list
    const ulMatch = trimmed.match(/^[-*] (.+)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) {
          finalProcessed.push(listType === 'ul' ? '</ul>' : '</ol>');
        }
        finalProcessed.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      const content = processInlineFormatting(ulMatch[1]);
      finalProcessed.push(`<li>${content}</li>`);
      continue;
    }
    
    // Ordered list
    const olMatch = trimmed.match(/^\d+\. (.+)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) {
          finalProcessed.push(listType === 'ul' ? '</ul>' : '</ol>');
        }
        finalProcessed.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      const content = processInlineFormatting(olMatch[1]);
      finalProcessed.push(`<li>${content}</li>`);
      continue;
    }
    
    // Close any open list
    if (inList) {
      finalProcessed.push(listType === 'ul' ? '</ul>' : '</ol>');
      inList = false;
      listType = null;
    }
    
    // Regular paragraph
    const processed = processInlineFormatting(trimmed);
    finalProcessed.push(`<p>${processed}</p>`);
  }
  
  // Close any open list
  if (inList) {
    finalProcessed.push(listType === 'ul' ? '</ul>' : '</ol>');
  }
  
  html = finalProcessed.join('\n');
  
  // Clean up
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/\n{3,}/g, '\n\n');
  
  return html;
}

/**
 * Process inline markdown formatting
 */
function processInlineFormatting(text) {
  // Process code spans first (before other formatting)
  text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  
  // Then bold
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Then italic (but not inside code)
  text = text.replace(/(?<!<code[^>]*>)(?<!>)\*([^*]+?)\*(?!<\/code>)/g, '<em>$1</em>');
  
  // Then links (handle both external and anchor links)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    // If it's an anchor link (starts with #), make it internal
    if (url.startsWith('#')) {
      return `<a href="${url}" class="anchor-link">${text}</a>`;
    }
    // External links open in new tab
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  
  return text;
}

// ============================================================
// DOCUMENTATION LOADER
// ============================================================

async function loadDocumentation() {
  const container = document.getElementById('documentationContent');
  if (!container) return;
  
  try {
    // Fetch markdown
    const response = await fetch('/BACKEND_ARCHITECTURE.md');
    if (!response.ok) {
      throw new Error('Failed to load documentation');
    }
    
    const markdown = await response.text();
    
    // Convert markdown to HTML
    const html = convertMarkdownToHTML(markdown);
    
    // Render with proper styling
    container.innerHTML = `
      <div class="documentation-wrapper">
        <div class="documentation-article">
          ${html}
        </div>
      </div>
    `;
    
    // Initialize Mermaid diagrams if available
    if (window.mermaid) {
      window.mermaid.initialize({ 
        startOnLoad: true, 
        theme: 'dark',
        securityLevel: 'loose'
      });
      window.mermaid.init(undefined, container.querySelectorAll('.mermaid-diagram'));
    }
    
    // Add ID attributes to headers for anchor linking
    container.querySelectorAll('h1, h2, h3, h4').forEach(header => {
      const text = header.textContent;
      const id = text.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      header.id = id;
    });
    
    // Handle anchor link clicks for smooth scrolling
    container.querySelectorAll('a.anchor-link').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const target = document.querySelector(href);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Update URL without jumping
            window.history.pushState(null, '', href);
          }
        }
      });
    });
    
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
  } catch (error) {
    console.error('Failed to load documentation:', error);
    container.innerHTML = `
      <div class="documentation-error">
        <h2 style="color: var(--bad); margin-bottom: 16px;">Error Loading Documentation</h2>
        <p style="color: var(--ink-muted); margin-bottom: 24px;">${escapeHtml(error.message || 'Unknown error')}</p>
        <button class="btn approve" onclick="loadDocumentation()">Retry</button>
      </div>
    `;
  }
}

// Export functions
window.loadDocumentation = loadDocumentation;
window.convertMarkdownToHTML = convertMarkdownToHTML;

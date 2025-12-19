# Kanva Botanicals Logo Files

## Logo Implementation Guide

### File Placement Options:

**Option 1: Local Files**
- Place your logo files in this folder: `assets/logo/`
- Recommended filenames:
  - `kanva-logo.svg` (primary - best quality, scalable)
  - `kanva-logo.png` (fallback - high resolution, at least 300px wide)

**Option 2: GitHub URL**
- Upload logo to GitHub repository
- Update the HTML img src to use the raw GitHub URL
- Example: `https://raw.githubusercontent.com/your-username/kanva-quotes/main/assets/logo/kanva-logo.svg`

### Current Implementation:

The header now includes:
- Automatic fallback from SVG to PNG if SVG fails to load
- Responsive design that adapts to mobile screens
- Professional styling with Kanva brand colors
- Hover effects and smooth transitions

### Logo Specifications:

**Recommended Dimensions:**
- SVG: Vector format (preferred)
- PNG: Minimum 300px wide, transparent background
- Aspect ratio: Maintain original logo proportions
- File size: Under 100KB for optimal loading

### HTML Structure:
```html
<div class="app-header">
    <div class="header-content">
        <img src="assets/logo/kanva-logo.svg" 
             alt="Kanva Botanicals" 
             class="kanva-logo"
             onerror="this.onerror=null; this.src='assets/logo/kanva-logo.png';">
        <div class="header-text">
            <h1 class="app-title">Quote Calculator</h1>
            <p class="app-subtitle">Instantly generate professional quotes with accurate pricing</p>
        </div>
    </div>
</div>
```

### Styling Features:
- Height: 60px on desktop, 50px on tablet, 40px on mobile
- Drop shadow effect
- Hover scale animation
- Responsive layout that stacks on mobile
- Professional gradient background

/**
 * Enhanced Git Connector for Kanva Quotes
 * Handles saving data to a Git repository with improved error handling and features
 * Converted from kanva-portal ES6 modules to vanilla JavaScript
 */

class GitConnector {
    /**
     * Initialize the Git connector
     * @param {Object} config - Configuration object
     * @param {string} config.repo - GitHub repository in format 'username/repo'
     * @param {string} config.branch - Branch to commit to (default: 'main')
     * @param {string} config.token - GitHub personal access token
     * @param {string} config.username - GitHub username
     * @param {string} config.email - GitHub email
     */
    constructor(config = {}) {
        this.repo = config.repo || 'benatkanva/kanva-quotes';
        this.branch = config.branch || 'main';
        this.token = config.token || '';
        this.username = config.username || 'kanva-admin';
        this.email = config.email || 'admin@kanva.com';
        this.baseUrl = 'https://api.github.com';
        
        console.log('🐙 GitConnector initialized for repo:', this.repo);
        
        // Load connection from server if available
        this.loadConnectionFromServer();
    }
    
    /**
     * Load GitHub connection from server or localStorage
     */
    async loadConnectionFromServer() {
        try {
            // Check if we're running on GitHub Pages (no local server)
            const isGitHubPages = window.location.hostname.includes('github.io');
            
            if (isGitHubPages) {
                // Running on GitHub Pages - load from localStorage only
                console.log('💾 Loading GitHub connection from localStorage (GitHub Pages mode)');
                this.loadFromLocalStorage();
                return;
            }
            
            // Running locally - try server endpoints
            // First try to load from secure env-config endpoint
            const envResponse = await fetch('/api/env-config');
            
            if (envResponse.ok) {
                const envResult = await envResponse.json();
                
                if (envResult.success && envResult.data && envResult.data.github) {
                    const githubConfig = envResult.data.github;
                    
                    // Update configuration from environment variables
                    if (githubConfig.token) this.token = githubConfig.token;
                    if (githubConfig.repo) this.repo = githubConfig.repo;
                    if (githubConfig.branch) this.branch = githubConfig.branch;
                    if (githubConfig.username) this.username = githubConfig.username;
                    if (githubConfig.email) this.email = githubConfig.email;
                    
                    console.log('✅ GitHub connection loaded from environment variables');
                    return;
                }
            }
            
            // Fall back to connections.json if env-config fails
            const response = await fetch('/api/connections');
            
            if (response.ok) {
                const result = await response.json();
                
                if (result.success && result.data && result.data.github) {
                    const githubConfig = result.data.github;
                    
                    // Update configuration from saved connections
                    if (githubConfig.token) this.token = githubConfig.token;
                    if (githubConfig.repo) this.repo = githubConfig.repo;
                    if (githubConfig.branch) this.branch = githubConfig.branch;
                    if (githubConfig.username) this.username = githubConfig.username;
                    if (githubConfig.email) this.email = githubConfig.email;
                    
                    console.log('✅ GitHub connection loaded from saved connections');
                    return;
                }
            }
            
            // Final fallback to localStorage
            console.warn('⚠️ Could not load GitHub connection from server, trying localStorage');
            this.loadFromLocalStorage();
            
        } catch (error) {
            console.warn('⚠️ Failed to load GitHub connection from server:', error);
            // Load from localStorage as fallback
            this.loadFromLocalStorage();
        }
    }
    
    /**
     * Save GitHub connection to server
     */
    /**
     * Load GitHub connection from localStorage
     */
    loadFromLocalStorage() {
        try {
            const savedConfig = localStorage.getItem('github_connection');
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                if (config.token) this.token = config.token;
                if (config.repo) this.repo = config.repo;
                if (config.branch) this.branch = config.branch;
                if (config.username) this.username = config.username;
                if (config.email) this.email = config.email;
                console.log('✅ GitHub token loaded from local storage');
                return true;
            }
        } catch (error) {
            console.warn('⚠️ Failed to load GitHub connection from localStorage:', error);
        }
        return false;
    }
    
    /**
     * Save GitHub connection to localStorage
     */
    saveToLocalStorage() {
        try {
            const config = {
                token: this.token,
                repo: this.repo,
                branch: this.branch,
                username: this.username,
                email: this.email,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('github_connection', JSON.stringify(config));
            console.log('✅ GitHub connection saved to local storage');
            return true;
        } catch (error) {
            console.warn('⚠️ Failed to save GitHub connection to localStorage:', error);
            return false;
        }
    }

    async saveConnectionToServer() {
        if (!this.token) {
            console.warn('⚠️ No GitHub token to save');
            return false;
        }
        
        // Check if we're running on GitHub Pages (no local server)
        const isGitHubPages = window.location.hostname.includes('github.io');
        
        if (isGitHubPages) {
            // Running on GitHub Pages - save to localStorage only
            console.log('💾 Saving GitHub connection to localStorage (GitHub Pages mode)');
            return this.saveToLocalStorage();
        }
        
        try {
            const response = await fetch('/api/connections/github', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: this.token,
                    repo: this.repo,
                    branch: this.branch,
                    username: this.username,
                    email: this.email,
                    timestamp: new Date().toISOString()
                })
            });
            
            // Check if response is ok before trying to parse JSON
            if (!response.ok) {
                console.warn(`⚠️ Server returned ${response.status} when saving GitHub connection`);
                // Save to localStorage as fallback
                const localSaved = this.saveToLocalStorage();
                return localSaved;
            }
            
            try {
                const result = await response.json();
                if (result.success) {
                    console.log('✅ GitHub connection saved to server');
                    // Also save to localStorage as backup
                    this.saveToLocalStorage();
                    return true;
                } else {
                    console.warn('⚠️ Failed to save GitHub connection to server:', result.message);
                    // Save to localStorage as fallback
                    const localSaved = this.saveToLocalStorage();
                    return localSaved;
                }
            } catch (jsonError) {
                console.warn('⚠️ Failed to parse GitHub connection save response:', jsonError);
                // Save to localStorage as fallback
                const localSaved = this.saveToLocalStorage();
                return localSaved;
            }
        } catch (error) {
            console.error('❌ Error saving GitHub connection to server:', error);
            // Save to localStorage as fallback
            const localSaved = this.saveToLocalStorage();
            return localSaved;
        }
    }
    
    /**
     * Configure GitHub connection settings
     * @param {Object} config - Configuration object
     * @param {string} config.token - GitHub personal access token
     * @param {string} config.repo - GitHub repository in format 'username/repo'
     * @param {string} config.branch - Branch to commit to
     * @param {string} config.username - GitHub username
     * @param {string} config.email - GitHub email
     * @returns {Promise<boolean>} - Success status
     */
    async configure(config = {}) {
        let updated = false;
        
        if (config.token) {
            this.token = config.token;
            updated = true;
        }
        
        if (config.repo) {
            this.repo = config.repo;
            updated = true;
        }
        
        if (config.branch) {
            this.branch = config.branch;
            updated = true;
        }
        
        if (config.username) {
            this.username = config.username;
            updated = true;
        }
        
        if (config.email) {
            this.email = config.email;
            updated = true;
        }
        
        if (updated) {
            console.log('✅ GitConnector configuration updated');
            
            // Save to server if token is available
            if (this.token) {
                return await this.saveConnectionToServer();
            }
        }
        
        return updated;
    }
    
    /**
     * Test GitHub connection
     * @returns {Promise<Object>} - Test result with status and message
     */
    async testConnection() {
        if (!this.token) {
            return {
                success: false,
                message: 'GitHub token not configured. Please enter a valid token.',
                details: null
            };
        }
        
        try {
            console.log('🔍 Testing GitHub connection...');
            
            // Test API access by getting repo info
            const url = `${this.baseUrl}/repos/${this.repo}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Connection successful, save to server
                await this.saveConnectionToServer();
                
                return {
                    success: true,
                    message: `Successfully connected to ${data.full_name}`,
                    details: {
                        name: data.name,
                        full_name: data.full_name,
                        description: data.description,
                        default_branch: data.default_branch,
                        owner: data.owner.login
                    }
                };
            } else {
                // API returned an error
                return {
                    success: false,
                    message: data.message || 'Failed to connect to GitHub repository',
                    details: data
                };
            }
        } catch (error) {
            console.error('❌ GitHub connection test failed:', error);
            return {
                success: false,
                message: `Connection error: ${error.message}`,
                details: error
            };
        }
    }
    
    /**
     * Get configuration information
     * @returns {Object} - Configuration object
     */
    getConfig() {
        return {
            repo: this.repo,
            branch: this.branch,
            username: this.username,
            email: this.email,
            hasToken: !!this.token,
            baseUrl: this.baseUrl
        };
    }
    
    /**
     * Get repository information
     * @returns {Promise<Object>} - Repository information
     */
    async getRepoInfo() {
        if (!this.token) {
            throw new Error('GitHub token not configured');
        }
        
        try {
            const url = `${this.baseUrl}/repos/${this.repo}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to get repository information');
            }
            
            return await response.json();
        } catch (error) {
            console.error('❌ Error getting repository information:', error);
            throw error;
        }
    }

    /**
     * Save data to a file in the repository
     * @param {string} path - Path to the file in the repository
     * @param {Object} data - Data to save
     * @param {string} message - Commit message
     * @returns {Promise<Object>} - API response
     */
    async saveFile(path, data, message = 'Update configuration via Admin Dashboard') {
        if (!this.token) {
            throw new Error('GitHub token not configured. Please set up Git integration in Admin Dashboard.');
        }

        try {
            console.log(`🐙 Saving file to GitHub: ${path}`);
            
            const url = `${this.baseUrl}/repos/${this.repo}/contents/${path}`;
            const content = JSON.stringify(data, null, 2);
            const contentEncoded = btoa(unescape(encodeURIComponent(content)));
            
            // Get the current SHA of the file if it exists
            let sha = '';
            try {
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'Kanva-Admin-Dashboard'
                    }
                });
                
                if (response.ok) {
                    const fileData = await response.json();
                    sha = fileData.sha;
                    console.log('📄 Found existing file, SHA:', sha);
                } else if (response.status !== 404) {
                    console.warn('⚠️ Unexpected response when checking file:', response.status);
                }
            } catch (error) {
                console.log('📄 File does not exist, will create new file');
            }
            
            // Prepare the commit data
            const commitData = {
                message: message,
                content: contentEncoded,
                branch: this.branch,
                committer: {
                    name: this.username,
                    email: this.email
                },
                author: {
                    name: this.username,
                    email: this.email
                }
            };
            
            // Include SHA if updating existing file
            if (sha) {
                commitData.sha = sha;
            }
            
            // Make the commit
            const commitResponse = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Kanva-Admin-Dashboard'
                },
                body: JSON.stringify(commitData)
            });
            
            if (!commitResponse.ok) {
                const errorData = await commitResponse.json();
                console.error('❌ GitHub API Error:', errorData);
                throw new Error(`GitHub API Error: ${errorData.message || commitResponse.statusText}`);
            }
            
            const result = await commitResponse.json();
            console.log('✅ File saved successfully to GitHub:', result.commit.sha);
            
            return {
                success: true,
                sha: result.commit.sha,
                url: result.content.html_url,
                message: message
            };
            
        } catch (error) {
            console.error('❌ Failed to save file to GitHub:', error);
            throw error;
        }
    }

    /**
     * Save multiple files in a single commit
     * @param {Array} files - Array of {path, data} objects
     * @param {string} message - Commit message
     * @returns {Promise<Object>} - API response
     */
    async saveMultipleFiles(files, message = 'Update multiple configuration files') {
        if (!this.token) {
            throw new Error('GitHub token not configured. Please set up Git integration in Admin Dashboard.');
        }

        try {
            console.log(`🐙 Saving ${files.length} files to GitHub in single commit`);
            
            // Get the current commit SHA
            const refUrl = `${this.baseUrl}/repos/${this.repo}/git/refs/heads/${this.branch}`;
            const refResponse = await fetch(refUrl, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Kanva-Admin-Dashboard'
                }
            });
            
            if (!refResponse.ok) {
                throw new Error(`Failed to get branch reference: ${refResponse.statusText}`);
            }
            
            const refData = await refResponse.json();
            const baseCommitSha = refData.object.sha;
            
            // Get the base tree
            const baseTreeUrl = `${this.baseUrl}/repos/${this.repo}/git/commits/${baseCommitSha}`;
            const baseTreeResponse = await fetch(baseTreeUrl, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Kanva-Admin-Dashboard'
                }
            });
            
            if (!baseTreeResponse.ok) {
                throw new Error(`Failed to get base tree: ${baseTreeResponse.statusText}`);
            }
            
            const baseTreeData = await baseTreeResponse.json();
            const baseTreeSha = baseTreeData.tree.sha;
            
            // Create tree with new files
            const treeItems = files.map(file => ({
                path: file.path,
                mode: '100644',
                type: 'blob',
                content: JSON.stringify(file.data, null, 2)
            }));
            
            const treeUrl = `${this.baseUrl}/repos/${this.repo}/git/trees`;
            const treeResponse = await fetch(treeUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Kanva-Admin-Dashboard'
                },
                body: JSON.stringify({
                    base_tree: baseTreeSha,
                    tree: treeItems
                })
            });
            
            if (!treeResponse.ok) {
                const treeError = await treeResponse.json();
                throw new Error(`Failed to create tree: ${treeError.message}`);
            }
            
            const treeData = await treeResponse.json();
            
            // Create commit
            const commitUrl = `${this.baseUrl}/repos/${this.repo}/git/commits`;
            const commitResponse = await fetch(commitUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Kanva-Admin-Dashboard'
                },
                body: JSON.stringify({
                    message: message,
                    tree: treeData.sha,
                    parents: [baseCommitSha],
                    author: {
                        name: this.username,
                        email: this.email
                    },
                    committer: {
                        name: this.username,
                        email: this.email
                    }
                })
            });
            
            if (!commitResponse.ok) {
                const commitError = await commitResponse.json();
                throw new Error(`Failed to create commit: ${commitError.message}`);
            }
            
            const commitData = await commitResponse.json();
            
            // Update the reference
            const updateRefResponse = await fetch(refUrl, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Kanva-Admin-Dashboard'
                },
                body: JSON.stringify({
                    sha: commitData.sha
                })
            });
            
            if (!updateRefResponse.ok) {
                const updateError = await updateRefResponse.json();
                throw new Error(`Failed to update reference: ${updateError.message}`);
            }
            
            console.log('✅ Multiple files saved successfully to GitHub:', commitData.sha);
            
            return {
                success: true,
                sha: commitData.sha,
                message: message,
                filesCount: files.length
            };
            
        } catch (error) {
            console.error('❌ Failed to save multiple files to GitHub:', error);
            throw error;
        }
    }

    /**
     * Test the connection to GitHub
     * @returns {Promise<Object>} - Test result
     */
    async testConnection() {
        if (!this.token) {
            return {
                success: false,
                error: 'GitHub token not configured'
            };
        }

        try {
            console.log('🔍 Testing GitHub connection...');
            
            const url = `${this.baseUrl}/repos/${this.repo}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Kanva-Admin-Dashboard'
                }
            });
            
            if (response.ok) {
                const repoData = await response.json();
                console.log('✅ GitHub connection successful');
                
                return {
                    success: true,
                    repo: repoData.full_name,
                    private: repoData.private,
                    permissions: repoData.permissions || {}
                };
            } else {
                const errorData = await response.json();
                console.error('❌ GitHub connection failed:', errorData);
                
                return {
                    success: false,
                    error: errorData.message || 'Connection failed',
                    status: response.status
                };
            }
            
        } catch (error) {
            console.error('❌ GitHub connection test error:', error);
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get repository information
     * @returns {Promise<Object>} - Repository data
     */
    async getRepoInfo() {
        if (!this.token) {
            throw new Error('GitHub token not configured');
        }

        try {
            const url = `${this.baseUrl}/repos/${this.repo}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Kanva-Admin-Dashboard'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to get repository info: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('❌ Failed to get repository info:', error);
            throw error;
        }
    }

    /**
     * List files in the data directory
     * @returns {Promise<Array>} - List of files
     */
    async listDataFiles() {
        if (!this.token) {
            throw new Error('GitHub token not configured');
        }

        try {
            const url = `${this.baseUrl}/repos/${this.repo}/contents/data`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Kanva-Admin-Dashboard'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to list data files: ${response.statusText}`);
            }
            
            const files = await response.json();
            return files.filter(file => file.type === 'file' && file.name.endsWith('.json'));
            
        } catch (error) {
            console.error('❌ Failed to list data files:', error);
            throw error;
        }
    }

    /**
     * Configure the Git connector with new settings
     * @param {Object} config - New configuration
     */
    configure(config) {
        if (config.repo) this.repo = config.repo;
        if (config.branch) this.branch = config.branch;
        if (config.token) this.token = config.token;
        if (config.username) this.username = config.username;
        if (config.email) this.email = config.email;
        
        console.log('🔧 GitConnector reconfigured for repo:', this.repo);
    }

    /**
     * Test connection to GitHub API
     * @returns {Promise<Object>} - Test result with success status and details
     */
    async testConnection() {
        if (!this.token) {
            return {
                success: false,
                error: 'No GitHub token configured',
                details: 'Please configure a GitHub personal access token in the admin settings.'
            };
        }

        try {
            console.log('🧪 Testing GitHub API connection...');
            
            // Test 1: Check if we can access the repository
            const repoUrl = `${this.baseUrl}/repos/${this.repo}`;
            const repoResponse = await fetch(repoUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Kanva-Quotes-Admin'
                }
            });

            if (!repoResponse.ok) {
                if (repoResponse.status === 401) {
                    return {
                        success: false,
                        error: 'Authentication failed',
                        details: 'Invalid GitHub token. Please check your token and permissions.'
                    };
                } else if (repoResponse.status === 404) {
                    return {
                        success: false,
                        error: 'Repository not found',
                        details: `Repository '${this.repo}' not found or not accessible with this token.`
                    };
                } else {
                    return {
                        success: false,
                        error: `HTTP ${repoResponse.status}`,
                        details: `GitHub API returned status ${repoResponse.status}: ${repoResponse.statusText}`
                    };
                }
            }

            const repoData = await repoResponse.json();
            
            // Test 2: Check if we can access the branch
            const branchUrl = `${this.baseUrl}/repos/${this.repo}/branches/${this.branch}`;
            const branchResponse = await fetch(branchUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Kanva-Quotes-Admin'
                }
            });

            if (!branchResponse.ok) {
                return {
                    success: false,
                    error: 'Branch not found',
                    details: `Branch '${this.branch}' not found in repository '${this.repo}'.`
                };
            }

            const branchData = await branchResponse.json();
            
            // Test successful
            console.log('✅ GitHub API connection test successful');
            return {
                success: true,
                details: {
                    repository: {
                        name: repoData.full_name,
                        private: repoData.private,
                        default_branch: repoData.default_branch,
                        permissions: {
                            admin: repoData.permissions?.admin || false,
                            push: repoData.permissions?.push || false,
                            pull: repoData.permissions?.pull || false
                        }
                    },
                    branch: {
                        name: branchData.name,
                        sha: branchData.commit.sha.substring(0, 7),
                        last_commit: branchData.commit.commit.author.date
                    },
                    token_scopes: repoResponse.headers.get('X-OAuth-Scopes') || 'Unknown'
                }
            };
            
        } catch (error) {
            console.error('❌ GitHub API connection test failed:', error);
            return {
                success: false,
                error: 'Connection failed',
                details: `Network or API error: ${error.message}`
            };
        }
    }

    /**
     * Get current configuration (without token for security)
     * @returns {Object} - Current configuration
     */
    getConfig() {
        return {
            repo: this.repo,
            branch: this.branch,
            username: this.username,
            email: this.email,
            hasToken: !!this.token
        };
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.GitConnector = GitConnector;
    
    // Create a global instance for admin manager to use
    window.gitConnector = new GitConnector();
}

console.log('✅ Enhanced GitConnector loaded successfully');

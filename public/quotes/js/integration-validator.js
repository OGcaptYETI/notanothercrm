/**
 * Integration Validator for Kanva Quotes
 * Tests and validates all API integrations (Git, Copper CRM, Fishbowl ERP)
 * Converted from kanva-portal ES6 modules to vanilla JavaScript
 */

class IntegrationValidator {
    constructor(options = {}) {
        this.gitConnector = options.gitConnector || window.gitConnector;
        this.copperIntegration = options.copperIntegration || window.CopperIntegration;
        this.adminManager = options.adminManager || window.AdminManager;
        
        this.validationResults = new Map();
        this.isRunning = false;
        
        console.log('🔍 IntegrationValidator initialized');
    }

    /**
     * Validate all integrations
     * @returns {Promise<Object>} - Validation results
     */
    async validateAll() {
        console.log('🔍 Starting full integration validation...');
        this.isRunning = true;
        
        const results = {
            timestamp: new Date().toISOString(),
            overall: 'pending',
            integrations: {}
        };

        try {
            // Test Git integration
            results.integrations.git = await this.validateGitIntegration();
            
            // Test Copper CRM integration
            results.integrations.copper = await this.validateCopperIntegration();
            
            // Test Fishbowl ERP integration (placeholder)
            results.integrations.fishbowl = await this.validateFishbowlIntegration();
            
            // Test RingCentral integration
            results.integrations.ringcentral = await this.validateRingCentralIntegration();
            
            // Determine overall status
            const allPassed = Object.values(results.integrations).every(result => result.status === 'success');
            const anyFailed = Object.values(results.integrations).some(result => result.status === 'error');
            
            if (allPassed) {
                results.overall = 'success';
            } else if (anyFailed) {
                results.overall = 'error';
            } else {
                results.overall = 'warning';
            }

            this.validationResults.set('latest', results);
            console.log('✅ Integration validation completed:', results.overall);
            
        } catch (error) {
            console.error('❌ Integration validation failed:', error);
            results.overall = 'error';
            results.error = error.message;
        } finally {
            this.isRunning = false;
        }

        return results;
    }

    /**
     * Validate Git integration
     * @returns {Promise<Object>} - Validation result
     */
    async validateGitIntegration() {
        console.log('🐙 Validating Git integration...');
        
        const result = {
            name: 'Git Integration',
            status: 'pending',
            tests: [],
            startTime: Date.now()
        };

        try {
            // Test 1: Check if GitConnector is available
            result.tests.push({
                name: 'GitConnector Availability',
                status: this.gitConnector ? 'success' : 'error',
                message: this.gitConnector ? 'GitConnector found' : 'GitConnector not available',
                duration: 0
            });

            if (!this.gitConnector) {
                result.status = 'error';
                result.message = 'GitConnector not available';
                return result;
            }

            // Test 2: Check configuration
            const config = this.gitConnector.getConfig();
            const hasConfig = config.repo && config.hasToken;
            result.tests.push({
                name: 'Configuration Check',
                status: hasConfig ? 'success' : 'warning',
                message: hasConfig ? 'Git configuration complete' : 'Git configuration incomplete',
                details: {
                    repo: config.repo,
                    branch: config.branch,
                    hasToken: config.hasToken
                },
                duration: 0
            });

            if (!hasConfig) {
                result.status = 'warning';
                result.message = 'Git integration not fully configured';
                return result;
            }

            // Test 3: Test connection
            const testStart = Date.now();
            const connectionTest = await this.gitConnector.testConnection();
            const testDuration = Date.now() - testStart;

            result.tests.push({
                name: 'Connection Test',
                status: connectionTest.success ? 'success' : 'error',
                message: connectionTest.success ? 'Git connection successful' : connectionTest.error,
                details: connectionTest,
                duration: testDuration
            });

            if (!connectionTest.success) {
                result.status = 'error';
                result.message = `Git connection failed: ${connectionTest.error}`;
                return result;
            }

            // Test 4: Test repository access
            try {
                const repoInfo = await this.gitConnector.getRepoInfo();
                result.tests.push({
                    name: 'Repository Access',
                    status: 'success',
                    message: `Repository access confirmed: ${repoInfo.full_name}`,
                    details: {
                        fullName: repoInfo.full_name,
                        private: repoInfo.private,
                        permissions: repoInfo.permissions
                    },
                    duration: 0
                });
            } catch (error) {
                result.tests.push({
                    name: 'Repository Access',
                    status: 'error',
                    message: `Repository access failed: ${error.message}`,
                    duration: 0
                });
                result.status = 'error';
                result.message = 'Repository access failed';
                return result;
            }

            result.status = 'success';
            result.message = 'Git integration fully functional';

        } catch (error) {
            console.error('❌ Git validation error:', error);
            result.status = 'error';
            result.message = `Git validation failed: ${error.message}`;
            result.tests.push({
                name: 'Validation Error',
                status: 'error',
                message: error.message,
                duration: 0
            });
        }

        result.endTime = Date.now();
        result.totalDuration = result.endTime - result.startTime;
        return result;
    }

    /**
     * Validate Copper CRM integration
     * @returns {Promise<Object>} - Validation result
     */
    async validateCopperIntegration() {
        console.log('🔄 Validating Copper CRM integration...');
        
        const result = {
            name: 'Copper CRM Integration',
            status: 'pending',
            tests: [],
            startTime: Date.now()
        };

        try {
            // Test 1: Check if Copper integration is available
            result.tests.push({
                name: 'Copper Integration Availability',
                status: this.copperIntegration ? 'success' : 'warning',
                message: this.copperIntegration ? 'Copper integration found' : 'Copper integration not available',
                duration: 0
            });

            if (!this.copperIntegration) {
                result.status = 'warning';
                result.message = 'Copper integration not available (will run in standalone mode)';
                return result;
            }

            // Test 2: Check Copper SDK availability
            const hasCopperSDK = typeof window.Copper !== 'undefined';
            result.tests.push({
                name: 'Copper SDK Check',
                status: hasCopperSDK ? 'success' : 'warning',
                message: hasCopperSDK ? 'Copper SDK available' : 'Copper SDK not loaded (standalone mode)',
                duration: 0
            });

            // Test 3: Check if running in Copper environment
            const isInCopper = window.self !== window.top || window.location.search.includes('copper');
            result.tests.push({
                name: 'Copper Environment Check',
                status: isInCopper ? 'success' : 'info',
                message: isInCopper ? 'Running in Copper environment' : 'Running outside Copper (standalone mode)',
                duration: 0
            });

            // Test 4: Test integration initialization
            try {
                const initResult = this.copperIntegration.initialize();
                result.tests.push({
                    name: 'Integration Initialization',
                    status: initResult ? 'success' : 'warning',
                    message: initResult ? 'Copper integration initialized' : 'Running in standalone mode',
                    duration: 0
                });
            } catch (error) {
                result.tests.push({
                    name: 'Integration Initialization',
                    status: 'error',
                    message: `Initialization failed: ${error.message}`,
                    duration: 0
                });
            }

            // Determine overall status based on availability
            if (hasCopperSDK && isInCopper) {
                result.status = 'success';
                result.message = 'Copper CRM integration fully functional';
            } else {
                result.status = 'warning';
                result.message = 'Copper CRM running in standalone mode (normal for development)';
            }

        } catch (error) {
            console.error('❌ Copper validation error:', error);
            result.status = 'error';
            result.message = `Copper validation failed: ${error.message}`;
            result.tests.push({
                name: 'Validation Error',
                status: 'error',
                message: error.message,
                duration: 0
            });
        }

        result.endTime = Date.now();
        result.totalDuration = result.endTime - result.startTime;
        return result;
    }

    /**
     * Validate Fishbowl ERP integration (placeholder)
     * @returns {Promise<Object>} - Validation result
     */
    async validateFishbowlIntegration() {
        console.log('🐠 Validating Fishbowl ERP integration...');
        
        const result = {
            name: 'Fishbowl ERP Integration',
            status: 'info',
            tests: [],
            startTime: Date.now(),
            message: 'Fishbowl integration not yet implemented'
        };

        try {
            // Test 1: Check if Fishbowl connector exists
            result.tests.push({
                name: 'Fishbowl Connector Availability',
                status: 'info',
                message: 'Fishbowl connector not yet implemented',
                duration: 0
            });

            // Test 2: Configuration check (placeholder)
            result.tests.push({
                name: 'Configuration Check',
                status: 'info',
                message: 'Fishbowl configuration not yet available',
                duration: 0
            });

            // Test 3: Connection test (placeholder)
            result.tests.push({
                name: 'Connection Test',
                status: 'info',
                message: 'Fishbowl connection test not yet implemented',
                duration: 0
            });

            result.status = 'info';
            result.message = 'Fishbowl ERP integration planned for future release';

        } catch (error) {
            console.error('❌ Fishbowl validation error:', error);
            result.status = 'error';
            result.message = `Fishbowl validation failed: ${error.message}`;
        }

        result.endTime = Date.now();
        result.totalDuration = result.endTime - result.startTime;
        return result;
    }

    /**
     * Validate RingCentral integration
     * @returns {Promise<Object>} - Validation result
     */
    async validateRingCentralIntegration() {
        console.log('📞 Validating RingCentral integration...');
        
        const result = {
            name: 'RingCentral Integration',
            status: 'success',
            tests: [],
            startTime: Date.now(),
            message: 'RingCentral integration validation complete'
        };

        try {
            // Test 1: Check hosting endpoints
            const baseUrl = 'https://kanvaportal.web.app';
            
            const statusTest = {
                name: 'RingCentral Status Endpoint',
                status: 'pending',
                message: 'Testing /rc/status endpoint...',
                duration: 0
            };
            
            const statusStart = Date.now();
            try {
                const response = await fetch(`${baseUrl}/rc/status`);
                statusTest.duration = Date.now() - statusStart;
                
                if (response.ok) {
                    const text = await response.text();
                    statusTest.status = 'success';
                    statusTest.message = `Status endpoint accessible (${response.status})`;
                } else {
                    statusTest.status = 'warning';
                    statusTest.message = `Status endpoint returned ${response.status}`;
                }
            } catch (error) {
                statusTest.duration = Date.now() - statusStart;
                statusTest.status = 'error';
                statusTest.message = `Status endpoint failed: ${error.message}`;
            }
            result.tests.push(statusTest);

            // Test 2: Check OAuth start endpoint
            const oauthTest = {
                name: 'OAuth Start Endpoint',
                status: 'pending',
                message: 'Testing /rc/auth/start endpoint...',
                duration: 0
            };
            
            const oauthStart = Date.now();
            try {
                const response = await fetch(`${baseUrl}/rc/auth/start`, { method: 'HEAD' });
                oauthTest.duration = Date.now() - oauthStart;
                
                if (response.ok || response.status === 302) {
                    oauthTest.status = 'success';
                    oauthTest.message = `OAuth endpoint accessible (${response.status})`;
                } else {
                    oauthTest.status = 'warning';
                    oauthTest.message = `OAuth endpoint returned ${response.status}`;
                }
            } catch (error) {
                oauthTest.duration = Date.now() - oauthStart;
                oauthTest.status = 'warning';
                oauthTest.message = `OAuth endpoint check failed: ${error.message}`;
            }
            result.tests.push(oauthTest);

            // Test 3: Check configuration
            const configTest = {
                name: 'Configuration Check',
                status: 'pending',
                message: 'Checking RingCentral configuration...',
                duration: 0
            };
            
            const configStart = Date.now();
            try {
                // Check if admin dashboard has RingCentral config
                const envVal = document.getElementById('ringcentral-environment')?.value?.trim();
                const clientIdVal = document.getElementById('ringcentral-client-id')?.value?.trim();
                const redirectUriVal = document.getElementById('ringcentral-redirect-uri')?.value?.trim();
                const hasSecretField = !!document.getElementById('ringcentral-client-secret');
                configTest.duration = Date.now() - configStart;

                const missing = [];
                if (!clientIdVal) missing.push('clientId');
                if (!redirectUriVal) missing.push('redirectUri');
                // environment can default; treat missing as info not error
                const hasCore = !!clientIdVal && !!redirectUriVal;

                if (hasCore) {
                    configTest.status = hasSecretField ? 'success' : 'warning';
                    configTest.message = hasSecretField
                        ? 'RingCentral config present (clientId, redirectUri). Client Secret field detected.'
                        : 'RingCentral config present, but Client Secret input field not found in UI.';
                    configTest.details = {
                        environment: envVal || '(default)',
                        hasClientId: !!clientIdVal,
                        hasRedirectUri: !!redirectUriVal,
                        hasClientSecretField: hasSecretField
                    };
                } else {
                    configTest.status = 'warning';
                    configTest.message = `RingCentral configuration incomplete: missing ${missing.join(', ')}`;
                    configTest.details = {
                        environment: envVal || '(default)',
                        hasClientId: !!clientIdVal,
                        hasRedirectUri: !!redirectUriVal,
                        hasClientSecretField: hasSecretField
                    };
                }
            } catch (error) {
                configTest.duration = Date.now() - configStart;
                configTest.status = 'info';
                configTest.message = 'Configuration check skipped (admin UI not available)';
            }
            result.tests.push(configTest);

            // Determine overall status
            const hasErrors = result.tests.some(test => test.status === 'error');
            const hasWarnings = result.tests.some(test => test.status === 'warning');
            
            if (hasErrors) {
                result.status = 'error';
                result.message = 'RingCentral integration has errors';
            } else if (hasWarnings) {
                result.status = 'warning';
                result.message = 'RingCentral integration has warnings';
            } else {
                result.status = 'success';
                result.message = 'RingCentral integration validation passed';
            }

        } catch (error) {
            console.error('❌ RingCentral validation error:', error);
            result.status = 'error';
            result.message = `RingCentral validation failed: ${error.message}`;
        }

        result.endTime = Date.now();
        result.totalDuration = result.endTime - result.startTime;
        return result;
    }

    /**
     * Get validation results summary
     * @returns {Object} - Summary of validation results
     */
    getValidationSummary() {
        const latest = this.validationResults.get('latest');
        if (!latest) {
            return {
                hasResults: false,
                message: 'No validation results available'
            };
        }

        const summary = {
            hasResults: true,
            timestamp: latest.timestamp,
            overall: latest.overall,
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            warningTests: 0,
            infoTests: 0,
            integrations: {}
        };

        // Count tests by status
        Object.entries(latest.integrations).forEach(([name, integration]) => {
            const integrationSummary = {
                status: integration.status,
                message: integration.message,
                testCount: integration.tests.length,
                duration: integration.totalDuration
            };

            integration.tests.forEach(test => {
                summary.totalTests++;
                switch (test.status) {
                    case 'success':
                        summary.passedTests++;
                        break;
                    case 'error':
                        summary.failedTests++;
                        break;
                    case 'warning':
                        summary.warningTests++;
                        break;
                    case 'info':
                        summary.infoTests++;
                        break;
                }
            });

            summary.integrations[name] = integrationSummary;
        });

        return summary;
    }

    /**
     * Generate validation report HTML
     * @returns {string} - HTML report
     */
    generateReport() {
        const latest = this.validationResults.get('latest');
        if (!latest) {
            return '<p>No validation results available. Run validation first.</p>';
        }

        const getStatusIcon = (status) => {
            switch (status) {
                case 'success': return '✅';
                case 'error': return '❌';
                case 'warning': return '⚠️';
                case 'info': return 'ℹ️';
                default: return '❓';
            }
        };

        const getStatusColor = (status) => {
            switch (status) {
                case 'success': return '#28a745';
                case 'error': return '#dc3545';
                case 'warning': return '#ffc107';
                case 'info': return '#17a2b8';
                default: return '#6c757d';
            }
        };

        let html = `
            <div class="validation-report" style="font-family: monospace;">
                <div class="report-header" style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
                    <h3>Integration Validation Report</h3>
                    <p><strong>Timestamp:</strong> ${new Date(latest.timestamp).toLocaleString()}</p>
                    <p><strong>Overall Status:</strong> 
                        <span style="color: ${getStatusColor(latest.overall)}; font-weight: bold;">
                            ${getStatusIcon(latest.overall)} ${latest.overall.toUpperCase()}
                        </span>
                    </p>
                </div>
                
                <div class="integrations-results">
        `;

        Object.entries(latest.integrations).forEach(([name, integration]) => {
            html += `
                <div class="integration-result" style="margin-bottom: 20px; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden;">
                    <div class="integration-header" style="
                        padding: 15px; 
                        background-color: ${getStatusColor(integration.status)}22;
                        border-bottom: 1px solid #dee2e6;
                    ">
                        <h4 style="margin: 0; color: ${getStatusColor(integration.status)};">
                            ${getStatusIcon(integration.status)} ${integration.name}
                        </h4>
                        <p style="margin: 5px 0 0 0; color: #6c757d;">${integration.message}</p>
                        <small>Duration: ${integration.totalDuration}ms</small>
                    </div>
                    
                    <div class="integration-tests" style="padding: 15px;">
                        ${integration.tests.map(test => `
                            <div class="test-result" style="
                                margin-bottom: 10px; 
                                padding: 8px; 
                                background-color: ${getStatusColor(test.status)}11;
                                border-left: 3px solid ${getStatusColor(test.status)};
                                border-radius: 4px;
                            ">
                                <div style="font-weight: bold;">
                                    ${getStatusIcon(test.status)} ${test.name}
                                    ${test.duration ? `<small style="float: right;">${test.duration}ms</small>` : ''}
                                </div>
                                <div style="margin-top: 4px; color: #6c757d;">${test.message}</div>
                                ${test.details ? `<pre style="margin-top: 8px; font-size: 12px; color: #495057;">${JSON.stringify(test.details, null, 2)}</pre>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Test specific integration
     * @param {string} integration - Integration name (git, copper, fishbowl)
     * @returns {Promise<Object>} - Validation result
     */
    async testIntegration(integration) {
        console.log(`🔍 Testing ${integration} integration...`);
        
        switch (integration.toLowerCase()) {
            case 'git':
                return await this.validateGitIntegration();
            case 'copper':
                return await this.validateCopperIntegration();
            case 'fishbowl':
                return await this.validateFishbowlIntegration();
            case 'ringcentral':
                return await this.validateRingCentralIntegration();
            default:
                throw new Error(`Unknown integration: ${integration}`);
        }
    }

    /**
     * Clear validation results
     */
    clearResults() {
        this.validationResults.clear();
        console.log('🗑️ Validation results cleared');
    }

    /**
     * Get validation status
     * @returns {Object} - Current status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            hasResults: this.validationResults.has('latest'),
            lastRun: this.validationResults.get('latest')?.timestamp || null
        };
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.IntegrationValidator = IntegrationValidator;
    
    // Create global instance
    window.integrationValidator = new IntegrationValidator();
}

console.log('✅ IntegrationValidator loaded successfully');

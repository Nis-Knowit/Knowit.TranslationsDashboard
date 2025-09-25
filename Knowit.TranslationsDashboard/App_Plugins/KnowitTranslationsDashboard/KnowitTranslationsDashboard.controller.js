angular.module("umbraco").controller("KnowitTranslationsDashboardController", [
    "$scope", 
    "$http",
    "editorService", 
    "notificationsService",
    "localizationService",
    "$timeout",
    function ($scope, $http, editorService, notificationsService, localizationService, $timeout) {
        var vm = this;
        vm.title = "Translations Dashboard";
        vm.loading = false;
        vm.allButtonState = "init";
        vm.query = "";
        vm.allItems = [];
        vm.hierarchyItems = [];
        vm.flattenedHierarchy = []; // Flattened hierarchy for table display
        vm.allLanguages = [];
        vm.selectedItem = null;
        vm.sortDirection = "asc";

        // Cache to store values for comparison to detect real changes
        var valueCache = {};

        // Debounce timer for dictionary refreshes
        var refreshTimer = null;
        var pendingUpdates = 0;

        // Pagination properties
        vm.pageSize = 100;
        vm.currentPage = 1;
        vm.totalPages = 1;
        vm.paginatedHierarchy = [];
        vm.rootItemsPerPage = 100; // Number of root items per page

        // Load all dictionary items
        vm.loadAllDictionary = function() {
            // Clear any pending refresh
            if (refreshTimer) {
                $timeout.cancel(refreshTimer);
                refreshTimer = null;
            }
            
            // If there are still pending updates, don't refresh yet
            if (pendingUpdates > 0) {
                console.log('Skipping refresh because there are still ' + pendingUpdates + ' pending updates');
                return;
            }
            
            vm.loading = true;
            vm.allButtonState = "busy";
            
            var url = "/umbraco/backoffice/KnowitTranslations/KnowitTranslationsApi/SearchAllDictionary";
            if (vm.query && vm.query.trim() !== '') {
                url += "?query=" + encodeURIComponent(vm.query.trim());
            }
            
            $http.get(url)
                .then(function(response) {
                    vm.allItems = response.data.Items;
                    vm.hierarchyItems = response.data.Hierarchy || [];
                    vm.allLanguages = response.data.Languages;
                    vm.loading = false;
                    vm.allButtonState = "success";
                    
                    // Set expanded state for tree nodes
                    setInitialExpandState(vm.hierarchyItems);
                    
                    // Create flattened version of hierarchy for table view
                    vm.flattenedHierarchy = flattenHierarchy(vm.hierarchyItems);
                    
                    // Update pagination
                    updatePagination();
                    
                    // Update the value cache with fresh data
                    updateValueCache();
                    
                    $timeout(function() {
                        vm.allButtonState = "init";
                        if (!$scope.$$phase) {
                            $scope.$apply();
                        }
                    }, 1000);
                }, function(error) {
                    notificationsService.error("Error", "Failed to load dictionary items: " + (error.data?.Message || error.statusText));
                    console.error("API Error:", error);
                    vm.loading = false;
                    vm.allButtonState = "error";
                    
                    $timeout(function() {
                        vm.allButtonState = "init";
                        if (!$scope.$$phase) {
                            $scope.$apply();
                        }
                    }, 1500);
                });
        };

        // Update the value cache with current values
        function updateValueCache() {
            // Clear the cache
            valueCache = {};
            
            // Populate with current values
            vm.allItems.forEach(function(item) {
                if (item.Key && item.Values) {
                    valueCache[item.Key] = {};
                    Object.keys(item.Values).forEach(function(lang) {
                        valueCache[item.Key][lang] = item.Values[lang];
                    });
                }
            });
            
            // Also cache hierarchy items
            function cacheHierarchyValues(nodes) {
                if (!nodes) return;
                
                nodes.forEach(function(node) {
                    if (node.key && node.values) {
                        if (!valueCache[node.key]) {
                            valueCache[node.key] = {};
                        }
                        
                        Object.keys(node.values).forEach(function(lang) {
                            valueCache[node.key][lang] = node.values[lang];
                        });
                    }
                    
                    // Recursively cache children
                    if (node.children && node.children.length) {
                        cacheHierarchyValues(node.children);
                    }
                });
            }
            
            cacheHierarchyValues(vm.hierarchyItems);
        }

        // Check if a value has actually changed
        function hasValueChanged(key, lang, newValue) {
            // If the key or language isn't in the cache, consider it changed
            if (!valueCache[key] || !valueCache[key].hasOwnProperty(lang)) {
                return true;
            }
            
            // Compare the cached value with the new value
            return valueCache[key][lang] !== newValue;
        }

        // Initialize by loading all dictionary items when the controller starts
        init();
        
        function init() {
            // Load all dictionary items on page load
            vm.loadAllDictionary();
        }
        
        // Get value for a node and language
        vm.getNodeValue = function(node, language) {
            if (node.values && node.values[language]) {
                return node.values[language];
            }
            
            if (node.originalItem && node.originalItem.Values && node.originalItem.Values[language]) {
                return node.originalItem.Values[language];
            }
            
            return '';
        };
        
        // Pagination functions
        function updatePagination() {
            // Get only the root level items for pagination
            var rootItems = vm.hierarchyItems.map(function(item) {
                return item;
            });
            
            // Calculate total pages based on root items
            vm.totalPages = Math.ceil(rootItems.length / vm.rootItemsPerPage);
            
            // Reset to first page if current page is now invalid
            if (vm.currentPage > vm.totalPages) {
                vm.currentPage = 1;
            }
            
            applyPagination();
        }
        
        function applyPagination() {
            // Step 1: Create an array of root-level nodes first
            var rootNodes = vm.hierarchyItems.slice();
            
            // Step 2: Calculate which root nodes should be on the current page
            var startIndex = (vm.currentPage - 1) * vm.rootItemsPerPage;
            var endIndex = startIndex + vm.rootItemsPerPage;
            var visibleRootNodes = rootNodes.slice(startIndex, endIndex);
            
            // Step 3: Get the flattened hierarchy for just these visible root nodes and their expanded children
            var visibleNodes = [];
            visibleRootNodes.forEach(function(rootNode) {
                // Add the root node
                visibleNodes.push(rootNode);
                
                // Add expanded children
                if (rootNode._expanded && rootNode.children) {
                    addExpandedChildren(rootNode.children, visibleNodes, 1);
                }
            });
            
            vm.paginatedHierarchy = visibleNodes;
        }
        
        // Helper function to recursively add expanded children to the visible nodes
        function addExpandedChildren(children, visibleNodes, level) {
            if (!children) return;
            
            children.forEach(function(child) {
                // Set the correct level
                child._level = level;
                
                // Add the child node
                visibleNodes.push(child);
                
                // Recursively add its expanded children
                if (child._expanded && child.children) {
                    addExpandedChildren(child.children, visibleNodes, level + 1);
                }
            });
        }
        
        vm.goToPage = function(page) {
            if (page < 1 || page > vm.totalPages) return;
            
            vm.currentPage = page;
            applyPagination();
        };
        
        vm.changePageSize = function() {
            vm.rootItemsPerPage = parseInt(vm.pageSize);
            vm.currentPage = 1; // Reset to first page when changing page size
            updatePagination();
        };
        
        vm.getDisplayedItemsRange = function() {
            var startItem = (vm.currentPage - 1) * vm.rootItemsPerPage + 1;
            var endItem = Math.min(startItem + vm.rootItemsPerPage - 1, vm.hierarchyItems.length);
            
            // Also add count of expanded children
            var totalDisplayedItems = vm.paginatedHierarchy.length;
            
            if (vm.paginatedHierarchy.length > vm.rootItemsPerPage) {
                return startItem + "-" + endItem + " (showing " + totalDisplayedItems + " items with expanded nodes)";
            } else {
                return startItem + "-" + endItem;
            }
        };
        
        // Flatten the hierarchy into a single array for table display
        function flattenHierarchy(nodes, level, visibilityPath) {
            if (!nodes) return [];
            level = level || 0;
            visibilityPath = visibilityPath || '';
            
            var result = [];
            
            nodes.forEach(function(node) {
                // Add level property to track indentation
                node._level = level;
                
                // Add visibility path to track parent expanded states
                var nodePath = visibilityPath + '/' + (node.id || node.key);
                node._visibilityPath = nodePath;
                
                // Add the node to the result
                result.push(node);
                
                // If node has children and is expanded, add them too
                if (node.children && node.children.length && node._expanded) {
                    var childrenResult = flattenHierarchy(node.children, level + 1, nodePath);
                    result = result.concat(childrenResult);
                }
            });
            
            return result;
        }
        
        // Set initial expanded state for tree nodes
        function setInitialExpandState(nodes) {
            if (!nodes) return;
            
            nodes.forEach(function(node) {
                // Root nodes are expanded by default, others collapsed
                if (node.isRoot) {
                    node._expanded = false;
                } else {
                    node._expanded = false;
                }
                
                // If we have a search query active, expand all nodes
                if (vm.query && vm.query.trim() !== '') {
                    node._expanded = true;
                }
                
                // Recursively process children
                if (node.children && node.children.length) {
                    setInitialExpandState(node.children);
                }
            });
        }
        
        // Toggle expanded state of a node
        vm.toggleNode = function(node) {
            if (node.isLeaf) return;
            node._expanded = !node._expanded;
            
            // Update the flattened hierarchy when node expansion changes
            vm.flattenedHierarchy = flattenHierarchy(vm.hierarchyItems);
            
            // Update pagination after changing the hierarchy structure
            applyPagination();
        };
        
        // Search all dictionary items
        vm.searchAllDictionary = function() {
            vm.loadAllDictionary();
        };
        
        // Sort items
        vm.sortItems = function(column) {
            // Toggle sort direction
            vm.sortDirection = vm.sortDirection === 'asc' ? 'desc' : 'asc';
            
            // Sort function for the hierarchical nodes
            function sortHierarchyByKey(items) {
                // Sort the current level
                var sorted = items.sort(function(a, b) {
                    var valA = a.key.toLowerCase();
                    var valB = b.key.toLowerCase();
                    
                    if (vm.sortDirection === 'asc') {
                        return valA.localeCompare(valB);
                    } else {
                        return valB.localeCompare(valA);
                    }
                });
                
                // Recursively sort children
                items.forEach(function(item) {
                    if (item.children && item.children.length) {
                        sortHierarchyByKey(item.children);
                    }
                });
                
                return sorted;
            }
            
            // Apply sorting to hierarchy
            vm.hierarchyItems = sortHierarchyByKey(vm.hierarchyItems);
            
            // Update the flattened hierarchy after sorting
            vm.flattenedHierarchy = flattenHierarchy(vm.hierarchyItems);
            
            // Update pagination after sorting
            updatePagination();
        };
        
        // Create a new dictionary item without a parent
        vm.createNewItem = function() {
            openCreateDialog(null);
        };
        
        // Create a child dictionary item
        vm.createChildItem = function(parentNode) {
            // Handle different property structures
            var parent = {
                key: parentNode.key || parentNode.Key,
                id: parentNode.id || parentNode.Id || 
                    (parentNode.originalItem ? (parentNode.originalItem.Id || parentNode.originalItem["Id"]) : null)
            };
            
            openCreateDialog(parent);
            if (event) event.stopPropagation();
        };
        
        // Open the create dialog
        function openCreateDialog(parentNode) {
            var initialValues = {};
            
            // Initialize empty values for all languages
            vm.allLanguages.forEach(function(lang) {
                initialValues[lang] = '';
            });
            
            editorService.open({
                title: parentNode ? "Create Child Translation" : "Create New Translation",
                view: "/App_Plugins/KnowitTranslationsDashboard/create.html",
                size: "medium",
                parentKey: parentNode ? parentNode.key : null,
                parentId: parentNode ? parentNode.id : null,
                key: "",
                languages: vm.allLanguages,
                values: initialValues,
                submit: function(model) {
                    createDictionaryItem(model);
                    editorService.close();
                },
                close: function() {
                    editorService.close();
                }
            });
        }
        
        // Create the dictionary item from the dialog
        function createDictionaryItem(model) {
            if (!model.key) {
                notificationsService.error("Error", "Please enter a key name");
                return;
            }
            
            // Format the key if a parent is specified
            var fullKey = model.key;
            if (model.parentKey) {
                fullKey = model.parentKey + "." + model.key;
            }
            
            vm.loading = true;
            
            // We'll use the first language to create the dictionary item initially
            var mainLanguage = vm.allLanguages[0];
            var mainValue = model.values[mainLanguage] || '';
            
            // Create the request data for initial creation
            var data = {
                key: fullKey,
                languageIsoCode: mainLanguage,
                value: mainValue
            };
            
            // Add the parent ID if a parent is specified
            if (model.parentId) {
                data.parentId = model.parentId;
            }
            
            // Increment pending updates counter
            pendingUpdates++;
            console.log('Starting create operation, pendingUpdates:', pendingUpdates);
            
            // First create the dictionary item with the main language
            $http({
                method: 'POST',
                url: '/umbraco/backoffice/KnowitTranslations/KnowitTranslationsApi/CreateDictionaryItem',
                data: data
            }).then(function(response) {
                // After successful creation, update translations for other languages
                var updateCount = 1; // Start at 1 for the initial creation
                var errorCount = 0;
                var remainingUpdates = vm.allLanguages.length - 1; // Minus 1 for the main language
                
                // If there's only one language, we're done
                if (remainingUpdates === 0) {
                    notificationsService.success("Success", "Dictionary item created successfully");
                    vm.loading = false;
                    
                    // Decrement pending updates and schedule refresh
                    pendingUpdates--;
                    console.log('Create complete, pendingUpdates:', pendingUpdates);
                    scheduleRefresh();
                    return;
                }
                
                // Update all other languages
                vm.allLanguages.forEach(function(lang) {
                    // Skip the main language as it's already set
                    if (lang === mainLanguage) return;
                    
                    // Increment pending updates for each language update
                    pendingUpdates++;
                    console.log('Adding language update, pendingUpdates:', pendingUpdates);
                    
                    updateTranslation(fullKey, lang, model.values[lang] || '', function(success) {
                        if (success) {
                            updateCount++;
                        } else {
                            errorCount++;
                        }
                        
                        // Decrement pending updates
                        pendingUpdates--;
                        console.log('Language update complete, pendingUpdates:', pendingUpdates);
                        
                        // When all updates are complete
                        if (updateCount + errorCount === vm.allLanguages.length) {
                            if (errorCount === 0) {
                                notificationsService.success("Success", "Dictionary item created successfully with all translations");
                            } else {
                                notificationsService.warning(
                                    "Partial Success", 
                                    "Dictionary item created, but " + errorCount + " translations failed to update"
                                );
                            }
                            vm.loading = false;
                            
                            // Decrement for the initial creation operation
                            pendingUpdates--;
                            console.log('All language updates complete, pendingUpdates:', pendingUpdates);
                            scheduleRefresh();
                        }
                    });
                });
            }, function(error) {
                notificationsService.error("Error", "Failed to create dictionary item: " + (error.data?.message || error.statusText));
                console.error("Create error:", error);
                vm.loading = false;
                
                // Decrement pending updates on error
                pendingUpdates--;
                console.log('Create failed, pendingUpdates:', pendingUpdates);
            });
        }
        
        // Edit all translations for an item
        vm.editAllTranslations = function(item) {
            // First make a clean copy of all values to avoid whitespace issues
            var cleanValues = getItemValues(item);
            Object.keys(cleanValues).forEach(function(lang) {
                if (cleanValues[lang]) {
                    cleanValues[lang] = cleanValues[lang].trim();
                }
            });
            
            // Open our multi-language editor
            editorService.open({
                title: "Edit All Translations",
                view: "/App_Plugins/KnowitTranslationsDashboard/editAll.html",
                size: "medium",
                key: item.key || item.Key,
                languages: vm.allLanguages,
                values: cleanValues, // Use clean values
                submit: function(model) {
                    updateAllTranslations(model);
                    editorService.close();
                },
                close: function() {
                    editorService.close();
                }
            });
        };
        
        // Helper to get values from an item based on its structure
        function getItemValues(item) {
            var values = {};
            
            if (item.values) {
                values = Object.assign({}, item.values);
            } else if (item.Values) {
                values = Object.assign({}, item.Values);
            } else if (item.originalItem) {
                if (item.originalItem.Values) {
                    values = Object.assign({}, item.originalItem.Values);
                } else if (typeof item.originalItem === 'object') {
                    // Try to access values through the "Values" property
                    for (var key in item.originalItem) {
                        if (key.toLowerCase() === 'values') {
                            values = Object.assign({}, item.originalItem[key]);
                            break;
                        }
                    }
                }
            }
            
            return values;
        }
        
        // Schedule a refresh of dictionary items with debouncing
        function scheduleRefresh() {
            // If there are still pending updates, don't schedule yet
            if (pendingUpdates > 0) {
                console.log('Not scheduling refresh, still have pending updates:', pendingUpdates);
                return;
            }
            
            // Cancel any previous timer
            if (refreshTimer) {
                $timeout.cancel(refreshTimer);
            }
            
            // Schedule a refresh after a delay
            console.log('Scheduling refresh in 500ms');
            refreshTimer = $timeout(function() {
                console.log('Executing scheduled refresh');
                vm.loadAllDictionary();
            }, 500);
        }
        
        // Update all translations for an item
        function updateAllTranslations(model) {
            vm.loading = true;
            
            // Get the key
            var key = model.key;
            
            // Collect only changes that are actually different
            var changedLanguages = [];
            var unchangedLanguages = [];
            
            vm.allLanguages.forEach(function(lang) {
                // Trim the value to avoid whitespace issues
                var value = model.values[lang];
                if (value !== undefined) {
                    value = value.toString().trim();
                    model.values[lang] = value;
                    
                    // Check if the value has actually changed
                    if (hasValueChanged(key, lang, value)) {
                        changedLanguages.push(lang);
                    } else {
                        unchangedLanguages.push(lang);
                    }
                }
            });
            
            console.log('Languages with changes:', changedLanguages);
            console.log('Languages without changes:', unchangedLanguages);
            
            // If nothing has changed, don't make any requests
            if (changedLanguages.length === 0) {
                notificationsService.info("Info", "No changes detected, nothing to update");
                vm.loading = false;
                return;
            }
            
            var updateCount = 0;
            var errorCount = 0;
            var totalChanges = changedLanguages.length;
            
            // Increment pending updates counter for the batch
            pendingUpdates++;
            console.log('Starting batch update, pendingUpdates:', pendingUpdates);
            
            // For each language with changes, update the translation
            changedLanguages.forEach(function(lang) {
                // Increment for each individual update
                pendingUpdates++;
                console.log('Adding language update for', lang, ', pendingUpdates:', pendingUpdates);
                
                updateTranslation(key, lang, model.values[lang], function(success) {
                    if (success) {
                        updateCount++;
                        
                        // Update value cache
                        if (!valueCache[key]) valueCache[key] = {};
                        valueCache[key][lang] = model.values[lang];
                    } else {
                        errorCount++;
                    }
                    
                    // Decrement for this individual update
                    pendingUpdates--;
                    console.log('Language update complete for', lang, ', pendingUpdates:', pendingUpdates);
                    
                    // When all updates are complete
                    if (updateCount + errorCount === totalChanges) {
                        if (errorCount === 0) {
                            notificationsService.success("Success", "All translations updated successfully");
                        } else {
                            notificationsService.warning(
                                "Partial Success", 
                                `${updateCount} of ${totalChanges} translations were updated successfully. ${errorCount} failed.`
                            );
                        }
                        vm.loading = false;
                        
                        // Decrement the batch counter
                        pendingUpdates--;
                        console.log('Batch update complete, pendingUpdates:', pendingUpdates);
                        scheduleRefresh();
                    }
                });
            });
        }
        
        // Confirm before deleting an item
        vm.confirmDelete = function(item) {
            var key = item.key || item.Key;
            
            if (!key) {
                notificationsService.error("Error", "Unable to determine key for deletion");
                return;
            }
            
            localizationService.localize("general_delete").then(function(headerValue) {
                const confirm = {
                    title: headerValue,
                    view: "default",
                    content: "Are you sure you want to delete '" + key + "'?",
                    submitButtonLabel: headerValue,
                    submitButtonStyle: "danger",
                    closeButtonLabel: "Cancel",
                    submit: function() {
                        deleteDictionaryItem(key);
                        editorService.close();
                    },
                    close: function() {
                        editorService.close();
                    }
                };
                editorService.open(confirm);
            });
            
            // Stop event propagation
            if (event) {
                event.stopPropagation();
            }
        };
        
        // Delete a dictionary item
        function deleteDictionaryItem(key) {
            vm.loading = true;
            
            // Increment pending updates
            pendingUpdates++;
            console.log('Starting delete operation, pendingUpdates:', pendingUpdates);
            
            $http({
                method: 'DELETE',
                url: '/umbraco/backoffice/KnowitTranslations/KnowitTranslationsApi/DeleteDictionaryItem?key=' + encodeURIComponent(key)
            }).then(function(response) {
                notificationsService.success("Success", "Dictionary item deleted successfully");
                
                // Decrement pending updates
                pendingUpdates--;
                console.log('Delete complete, pendingUpdates:', pendingUpdates);
                
                vm.loading = false;
                
                // Schedule refresh
                scheduleRefresh();
            }, function(error) {
                notificationsService.error("Error", "Failed to delete dictionary item: " + (error.data?.message || error.statusText));
                console.error("Delete error:", error);
                vm.loading = false;
                
                // Decrement pending updates on error
                pendingUpdates--;
                console.log('Delete failed, pendingUpdates:', pendingUpdates);
            });
        }
        
        // Helper to update a specific translation value
        function updateTranslation(key, language, value, callback) {
            // Make sure we have clean values
            if (value !== null && value !== undefined) {
                value = value.toString().trim();
            }
            
            // Use our custom endpoint instead of the Umbraco built-in one
            $http({
                method: 'POST',
                url: '/umbraco/backoffice/KnowitTranslations/KnowitTranslationsApi/UpdateDictionaryItem',
                data: {
                    key: key,
                    languageIsoCode: language,
                    value: value
                }
            }).then(function(response) {
                console.log('Update successful for key:', key, 'language:', language);
                if (callback) callback(true);
            }, function(error) {
                notificationsService.error("Error", "Failed to update translation: " + (error.data?.message || error.statusText));
                console.error("Update error for key:", key, "language:", language, error);
                if (callback) callback(false);
            });
        }
    }
]);

// Add a controller for our edit view
angular.module("umbraco").controller("KnowitTranslationsEditController", [
    "$scope",
    function($scope) {
        var vm = this;
        
        vm.close = close;
        vm.submit = submit;
        
        function close() {
            if ($scope.model && $scope.model.close) {
                $scope.model.close();
            }
        }
        
        function submit() {
            if ($scope.model && $scope.model.submit) {
                $scope.model.submit($scope.model);
            }
        }
    }
]);

// Add a controller for our create view
angular.module("umbraco").controller("KnowitTranslationsCreateController", [
    "$scope",
    function($scope) {
        var vm = this;
        
        vm.close = close;
        vm.submit = submit;
        
        function close() {
            if ($scope.model && $scope.model.close) {
                $scope.model.close();
            }
        }
        
        function submit() {
            if ($scope.model && $scope.model.submit) {
                $scope.model.submit($scope.model);
            }
        }
    }
]);

// Add a controller for our edit all translations view
angular.module("umbraco").controller("KnowitTranslationsEditAllController", [
    "$scope",
    function($scope) {
        var vm = this;
        
        vm.close = close;
        vm.submit = submit;
        
        function close() {
            if ($scope.model && $scope.model.close) {
                $scope.model.close();
            }
        }
        
        function submit() {
            if ($scope.model && $scope.model.submit) {
                $scope.model.submit($scope.model);
            }
        }
    }
]);
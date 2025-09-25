using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Linq;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Web.BackOffice.Controllers;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Web.Common.Attributes;

namespace Knowit.TranslationsDashboard.Controllers
{
    [PluginController("KnowitTranslations")]
    public class KnowitTranslationsApiController : UmbracoAuthorizedApiController
    {
        private readonly ILocalizationService _localizationService;

        public KnowitTranslationsApiController(ILocalizationService localizationService)
        {
            _localizationService = localizationService;
        }

        [HttpGet]
        public IActionResult SearchDictionary(string query)
        {
            if (string.IsNullOrWhiteSpace(query))
                return Ok(new List<object>());

            var allItems = _localizationService.GetDictionaryItemDescendants(null);
            var results = new List<object>();

            foreach (var item in allItems)
            {
                var matchesKey = item.ItemKey.Contains(query, System.StringComparison.OrdinalIgnoreCase);
                var matchesValue = item.Translations.Any(t => t.Value != null && t.Value.Contains(query, System.StringComparison.OrdinalIgnoreCase));

                if (matchesKey || matchesValue)
                {
                    results.Add(new
                    {
                        Key = item.ItemKey,
                        Values = item.Translations.ToDictionary(t => t.LanguageIsoCode, t => t.Value),
                        ParentId = item.ParentId
                    });
                }
            }

            // Sort results alphabetically by key
            results = results.OrderBy(item => ((dynamic)item).Key).ToList();

            return Ok(results);
        }

        [HttpGet]
        public IActionResult GetAllDictionary()
        {
            var allItems = _localizationService.GetDictionaryItemDescendants(null);
            var results = new List<object>();

            // Get all available languages first
            var allLanguages = new HashSet<string>(
                allItems.SelectMany(item => item.Translations)
                        .Select(t => t.LanguageIsoCode)
                        .Distinct());

            // Process each dictionary item
            foreach (var item in allItems)
            {
                var translationValues = new Dictionary<string, string>();
                
                // For each language, find the translation
                foreach (var lang in allLanguages)
                {
                    // Find the first translation for this language
                    var translation = item.Translations
                        .FirstOrDefault(t => t.LanguageIsoCode == lang);
                    
                    // Add it to our values dictionary (may be null)
                    translationValues[lang] = translation?.Value;
                }
                
                results.Add(new
                {
                    Key = item.ItemKey,
                    Values = translationValues,
                    ParentId = item.ParentId,
                    Id = item.Key // Include the unique ID for easier lookup
                });
            }

            // Sort results alphabetically by key
            results = results.OrderBy(item => ((dynamic)item).Key).ToList();

            return Ok(results);
        }
        
        [HttpGet]
        public IActionResult SearchAllDictionary(string query = "")
        {
            var allItems = _localizationService.GetDictionaryItemDescendants(null);
            
            // Get all available languages first
            var allLanguages = new HashSet<string>(
                allItems.SelectMany(item => item.Translations)
                        .Select(t => t.LanguageIsoCode)
                        .Distinct()).ToList();

            // Filter items if query is provided
            if (!string.IsNullOrWhiteSpace(query))
            {
                allItems = allItems.Where(item => 
                    item.ItemKey.Contains(query, System.StringComparison.OrdinalIgnoreCase) ||
                    item.Translations.Any(t => t.Value != null && t.Value.Contains(query, System.StringComparison.OrdinalIgnoreCase))
                ).ToList();
            }

            // Process each dictionary item
            var results = new List<Dictionary<string, object>>();
            foreach (var item in allItems)
            {
                var translationValues = new Dictionary<string, string>();
                
                // For each language, find the translation
                foreach (var lang in allLanguages)
                {
                    // Find the first translation for this language
                    var translation = item.Translations
                        .FirstOrDefault(t => t.LanguageIsoCode == lang);
                    
                    // Add it to our values dictionary (may be null)
                    translationValues[lang] = translation?.Value;
                }
                
                results.Add(new Dictionary<string, object>
                {
                    { "Key", item.ItemKey },
                    { "Values", translationValues },
                    { "ParentId", item.ParentId },
                    { "Id", item.Key }
                });
            }

            // Sort results alphabetically by key
            results = results.OrderBy(item => (string)item["Key"]).ToList();

            // Build a hierarchical structure based on Umbraco's parent-child relationship
            var hierarchy = BuildNaturalHierarchy(results);

            return Ok(new { 
                Items = results,
                Hierarchy = hierarchy,
                Languages = allLanguages,
                TotalCount = results.Count
            });
        }

        /// <summary>
        /// Builds a hierarchical structure based on Umbraco's native parent-child relationship
        /// </summary>
        private List<Dictionary<string, object>> BuildNaturalHierarchy(List<Dictionary<string, object>> items)
        {
            // Create a lookup for items by their ID
            var itemsById = items.ToDictionary(
                item => item["Id"],
                item => item
            );
            
            // Find all root items (items with no parent or parent outside our scope)
            var rootItems = items
                .Where(item => item["ParentId"] == null || !itemsById.ContainsKey(item["ParentId"]))
                .ToList();
            
            // Create hierarchy nodes from root items
            var hierarchy = new List<Dictionary<string, object>>();
            foreach (var rootItem in rootItems)
            {
                var node = CreateHierarchyNode(rootItem, itemsById);
                hierarchy.Add(node);
            }
            
            // Sort hierarchy by key at each level
            SortHierarchyByKey(hierarchy);
            
            return hierarchy;
        }
        
        /// <summary>
        /// Creates a hierarchy node from a dictionary item and recursively adds its children
        /// </summary>
        private Dictionary<string, object> CreateHierarchyNode(Dictionary<string, object> item, Dictionary<object, Dictionary<string, object>> itemsById)
        {
            var node = new Dictionary<string, object>
            {
                { "key", item["Key"] },
                { "id", item["Id"] },
                { "isRoot", item["ParentId"] == null },
                { "parentId", item["ParentId"] },
                { "children", new List<Dictionary<string, object>>() },
                { "values", item["Values"] },
                { "originalItem", item }
            };
            
            // Find all children of this item
            var children = itemsById.Values
                .Where(i => i["ParentId"] != null && i["ParentId"].Equals(item["Id"]))
                .ToList();
            
            // If this item has children, it's not a leaf
            node["isLeaf"] = !children.Any();
            
            // Process children recursively
            foreach (var child in children)
            {
                var childNode = CreateHierarchyNode(child, itemsById);
                ((List<Dictionary<string, object>>)node["children"]).Add(childNode);
            }
            
            return node;
        }
        
        private void SortHierarchyByKey(List<Dictionary<string, object>> items)
        {
            // Sort the current level
            var sorted = items.OrderBy(i => (string)i["key"]).ToList();
            items.Clear();
            items.AddRange(sorted);
            
            // Recursively sort children
            foreach (var item in items)
            {
                if (item.ContainsKey("children") && item["children"] is List<Dictionary<string, object>> children)
                {
                    SortHierarchyByKey(children);
                }
            }
        }

        public class UpdateDictionaryItemRequest
        {
            public string Key { get; set; }
            public string LanguageIsoCode { get; set; }
            public string Value { get; set; }
            public object ParentId { get; set; }
        }

        [HttpPost]
        public IActionResult UpdateDictionaryItem([FromBody] UpdateDictionaryItemRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Key))
            {
                return BadRequest("Invalid request. Key is required.");
            }

            try
            {
                // Get the dictionary item
                var dictionaryItem = _localizationService.GetDictionaryItemByKey(request.Key);
                if (dictionaryItem == null)
                {
                    return NotFound($"Dictionary item with key '{request.Key}' not found");
                }

                // Direct update approach using Dictionary Item's existing translations
                var translation = dictionaryItem.Translations.FirstOrDefault(t => t.LanguageIsoCode == request.LanguageIsoCode);
                if (translation != null)
                {
                    // Update existing translation
                    translation.Value = request.Value;
                }
                else
                {
                    // Language not found for this item
                    return NotFound($"Translation for language '{request.LanguageIsoCode}' not found on this dictionary item");
                }
                
                // Save changes
                _localizationService.Save(dictionaryItem);

                return Ok(new { success = true, message = "Dictionary item updated successfully" });
            }
            catch (System.Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error updating dictionary item: {ex.Message}" });
            }
        }
        
        [HttpPost]
        public IActionResult CreateDictionaryItem([FromBody] UpdateDictionaryItemRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Key))
            {
                return BadRequest("Invalid request. Key is required.");
            }

            try
            {
                // Check if the dictionary item already exists
                var existingItem = _localizationService.GetDictionaryItemByKey(request.Key);
                if (existingItem != null)
                {
                    return BadRequest($"Dictionary item with key '{request.Key}' already exists");
                }

                // Find the parent item if a parentId is provided
                Guid? parentId = null;
                if (request.ParentId != null)
                {
                    if (request.ParentId is Guid guid)
                    {
                        parentId = guid;
                    }
                    else if (Guid.TryParse(request.ParentId.ToString(), out Guid parsedGuid))
                    {
                        parentId = parsedGuid;
                    }
                }
                
                // Create the dictionary item
                var dictionaryItem = _localizationService.CreateDictionaryItemWithIdentity(
                    request.Key,
                    parentId,
                    request.Value);

                return Ok(new { success = true, message = "Dictionary item created successfully" });
            }
            catch (System.Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error creating dictionary item: {ex.Message}" });
            }
        }

        [HttpDelete]
        public IActionResult DeleteDictionaryItem(string key)
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return BadRequest("Invalid request. Key is required.");
            }

            try
            {
                // Get the dictionary item
                var dictionaryItem = _localizationService.GetDictionaryItemByKey(key);
                if (dictionaryItem == null)
                {
                    return NotFound($"Dictionary item with key '{key}' not found");
                }

                // Delete the dictionary item
                _localizationService.Delete(dictionaryItem);

                return Ok(new { success = true, message = "Dictionary item deleted successfully" });
            }
            catch (System.Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error deleting dictionary item: {ex.Message}" });
            }
        }
    }
}
# Knowit Translations Dashboard for Umbraco

A translation management dashboard for Umbraco 13+ that provides an enhanced user experience for managing dictionary items and translations.

## Features

- **Hierarchical View**: View your dictionary items in a tree structure
- **Advanced Pagination**: Navigate easily through large sets of translations with smart pagination
- **Inline Editing**: Edit translations directly in the dashboard
- **Search**: Quickly find translations by searching keys or values
- **Expandable Nodes**: Expand/collapse hierarchy nodes for better organization
- **Multi-language Support**: Full support for all languages configured in your Umbraco installation

## Installation

### NuGet Package Manager

```
Install-Package Knowit.TranslationsDashboard
```

### .NET CLI

```
dotnet add package Knowit.TranslationsDashboard
```

## Usage

After installation, a new section called "KnowitTranslations" will be available as a section to use on a usergroup.


Table overview with values
<img width="2524" height="943" alt="image" src="https://github.com/user-attachments/assets/2a02c8d2-ae36-4933-a488-5c79e606a119" />

Search directly on the dictionary value (or the key if you want)
<img width="2498" height="577" alt="image" src="https://github.com/user-attachments/assets/3f2c3487-4c21-4e3b-aecf-2fb5e824c187" />

### Managing Translations

- **Create new translations**: Click the "Create New Translation" button
- **Edit translations**: Click the edit icon on any row
- **Create child translations**: Click the plus icon on any row
- **Delete translations**: Click the trash icon on any row
- **Sort translations**: Click the column headers to sort
- **Search translations**: Use the search box to find specific keys or values

## License

This package is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For support, please open an issue on our [GitHub repository](https://github.com/knowit/umbraco-translations-dashboard/issues).

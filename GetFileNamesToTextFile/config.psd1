@{
    # Folder to scan. Relative paths are anchored to this script folder.
    SourceFolder = '.'

    # Text file to create. Relative paths are anchored to this script folder.
    OutputPath = '.\file_names.txt'

	# What to do if OutputPath already exists: 'Fail', 'Overwrite', or 'CreateNew'.
	ExistingOutputFileMode = 'Overwrite'

    # Set to $true to include files from subfolders.
    IncludeSubfolders = $false

    # Skip files marked with the hidden attribute.
    ExcludeHiddenFiles = $true

    # Skip dotfiles such as .gitignore.
    ExcludeDotFiles = $true

	# Case-insensitive list of extensions to include.
	# Clear this list to include all extensions.
	# Examples:
	# '.txt'
	# '.jpg'
	# '.pdf'
	IncludedExtensions = @(
		'.txt',
		'.md',
		'.csv',
		'.json',
		'.xml',
		'.pdf',
		'.doc',
		'.docx',
		'.xls',
		'.xlsx',
		'.ppt',
		'.pptx',
		'.jpg',
		'.jpeg',
		'.png',
		'.gif',
		'.webp',
		'.mp3',
		'.mp4',
		'.zip',
		'.7z',
		'.rar'
	)
}

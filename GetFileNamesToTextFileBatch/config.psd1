@{
	# Add one entry per source/output pair.
	# Relative paths are anchored to this script folder.
	Pairs = @(
		@{
			SourceFolder = '.'
			OutputPath = '.\file_names.txt'
			ExistingOutputFileMode = 'Overwrite'
			IncludeSubfolders = $false
			AllowReparsePointSourceRoot = $true
			AllowReparsePointOutputDirectory = $true
		}

		# Copy this block to add another source/output pair.
		# @{
		# 	SourceFolder = '.\another-source'
		# 	OutputPath = '.\another_file_names.txt'
		# 	ExistingOutputFileMode = 'Overwrite'
		# 	IncludeSubfolders = $true
		# 	AllowReparsePointSourceRoot = $true
		# 	AllowReparsePointOutputDirectory = $true
		# }
	)

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

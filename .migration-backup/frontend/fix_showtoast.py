import os
import re

def remove_local_showtoast(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Regex to match the local showToast function
    # Matches:
    # const showToast = (message, type) => {
    #   setToast({ message, type });
    #   ...
    # };
    # And variants with useCallback
    
    # 1. Standard arrow function
    pattern1 = r'const showToast\s*=\s*\([^\)]*\)\s*=>\s*\{[\s\S]*?setToast\([\s\S]*?\};?'
    content = re.sub(pattern1, '', content)

    # 2. useCallback variant
    pattern2 = r'const showToast\s*=\s*useCallback\(\s*\([^\)]*\)\s*=>\s*\{[\s\S]*?setToast\([\s\S]*?\}\s*,\s*\[.*?\]\s*\);?'
    content = re.sub(pattern2, '', content)

    # Also fix some other issues in StudentsList.tsx
    if 'StudentsList.tsx' in filepath:
        content = content.replace('_Filter', 'Filter')
        content = content.replace('_isCollegeAdmin', 'isCollegeAdmin')

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Removed local showToast from: {filepath}")

def main():
    root_dir = r"C:\Users\omar4\Desktop\University management system\frontend\src"
    for subdir, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.jsx'):
                filepath = os.path.join(subdir, file)
                remove_local_showtoast(filepath)

if __name__ == '__main__':
    main()

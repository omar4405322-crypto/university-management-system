import os
import re

def fix_syntax(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # The exact string left over by the previous two regexes
    leftover = "\n  );\n    \n  };\n"
    if leftover in content:
        content = content.replace(leftover, "\n")
    
    # Another variation without spaces
    leftover2 = "\n  );\n  };\n"
    if leftover2 in content:
        content = content.replace(leftover2, "\n")

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed syntax in: {filepath}")

def main():
    root_dir = r"C:\Users\omar4\Desktop\University management system\frontend\src"
    for subdir, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.jsx'):
                filepath = os.path.join(subdir, file)
                fix_syntax(filepath)

if __name__ == '__main__':
    main()

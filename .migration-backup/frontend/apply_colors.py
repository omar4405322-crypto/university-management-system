import os
import re
import difflib

def apply_replacements(text):
    text = re.sub(r'brand-sidebar(?!-)', 'navy-500', text)
    text = re.sub(r'brand-green-dark(?!-)', 'primary-500', text)
    text = re.sub(r'brand-green-light(?!-)', 'primary-300', text)
    text = re.sub(r'brand-green(?!-)', 'primary-400', text)
    text = re.sub(r'brand-navy-dark(?!-)', 'navy-700', text)
    text = re.sub(r'brand-navy-light(?!-)', 'navy-300', text)
    text = re.sub(r'brand-navy-(\d+)(?!-)', r'navy-\1', text)
    text = re.sub(r'brand-navy(?!-)', 'navy-500', text)
    return text

files_to_diff = ['Sidebar.tsx', 'Button.tsx', 'Login.tsx', 'CollegesList.tsx', 'AppShell.tsx']
diffs = {}

for root, _, files in os.walk('frontend/src'):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.jsx')) and not file.endswith('.bak'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = apply_replacements(content)
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                
                if file in files_to_diff:
                    diff = list(difflib.unified_diff(
                        content.splitlines(),
                        new_content.splitlines(),
                        fromfile=f'a/{file}',
                        tofile=f'b/{file}',
                        lineterm=''
                    ))
                    diffs[file] = '\n'.join(diff)

for file, diff_text in diffs.items():
    print(f"--- Diff for {file} ---")
    print(diff_text)
    print("")

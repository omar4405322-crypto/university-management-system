import os
import re

def reverse_replacements(text):
    text = re.sub(r'primary-500', 'brand-green-dark', text)
    text = re.sub(r'primary-300', 'brand-green-light', text)
    text = re.sub(r'primary-400', 'brand-green', text)
    text = re.sub(r'navy-700', 'brand-navy-dark', text)
    text = re.sub(r'navy-300', 'brand-navy-light', text)
    text = re.sub(r'navy-(\d+)', r'brand-navy-\1', text)
    # Special case for Sidebar
    # Actually, Sidebar.tsx used brand-sidebar. We can fix that specifically.
    return text

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.jsx')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = reverse_replacements(content)
            
            if file == 'Sidebar.tsx':
                new_content = new_content.replace('bg-brand-navy-500', 'bg-brand-sidebar')
                new_content = new_content.replace('bg-brand-navy', 'bg-brand-sidebar') # if any leftovers
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)

print("Reverse colors applied.")

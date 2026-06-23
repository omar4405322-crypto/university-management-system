import os
import re

def reverse_replacements(text):
    text = re.sub(r'(?<!brand-)primary-500', 'brand-green-dark', text)
    text = re.sub(r'(?<!brand-)primary-300', 'brand-green-light', text)
    text = re.sub(r'(?<!brand-)primary-400', 'brand-green', text)
    text = re.sub(r'(?<!brand-)navy-700', 'brand-navy-dark', text)
    text = re.sub(r'(?<!brand-)navy-300', 'brand-navy-light', text)
    text = re.sub(r'(?<!brand-)navy-(\d+)', r'brand-navy-\1', text)
    return text

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.jsx')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = reverse_replacements(content)
            
            # Special case for Sidebar.tsx
            if file == 'Sidebar.tsx':
                new_content = new_content.replace('brand-navy-500', 'brand-sidebar')
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)

print("Reverse colors applied correctly.")

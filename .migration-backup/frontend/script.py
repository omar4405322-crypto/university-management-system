import os
import re

src_dir = r"c:\Users\omar4\Desktop\University management system\frontend\src"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # Fix the trailing slash issue
    # We look for `<Icon ... / className=\"rtl:-scale-x-100\">`
    # and change it to `<Icon ... className=\"rtl:-scale-x-100\" />`
    
    icons = ['LogOut', 'ArrowRight', 'ArrowLeft', 'Send', 'ChevronRight', 'ChevronLeft', 'ExternalLink']
    
    for icon in icons:
        # e.g., `<LogOut size={18} / className="rtl:-scale-x-100">`
        # Using string interpolation for regex
        pattern = r'<' + icon + r'([^>]*?)\s*/\s*className=([\"\'`])rtl:-scale-x-100\2\s*>'
        content = re.sub(pattern, r'<' + icon + r'\1 className=\g<2>rtl:-scale-x-100\g<2> />', content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.jsx', '.tsx')):
            process_file(os.path.join(root, file))

import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Replace console.* with logger.*
    # We must be careful not to replace it if it's already logger.* or if console is used as a string.
    # A simple regex \bconsole\.(log|error|warn|info)\b should be safe.
    
    pattern = re.compile(r'\bconsole\.(log|error|warn|info)\b')
    if not pattern.search(content):
        return False
        
    content = pattern.sub(r'logger.\1', content)
    
    if content != original_content:
        # Determine import path
        parts = filepath.split('src')[1].strip('\\/').replace('\\', '/').split('/')
        up_levels = len(parts) - 1
        prefix = '../' * up_levels if up_levels > 0 else './'
        
        import_stmt = f"import {{ logger }} from '{prefix}lib/logger';\n"
        
        if 'import { logger }' not in content:
            # add import after last import
            last_import_idx = content.rfind('import ')
            if last_import_idx != -1:
                end_of_last_import = content.find('\n', last_import_idx)
                if end_of_last_import != -1:
                    content = content[:end_of_last_import+1] + import_stmt + content[end_of_last_import+1:]
                else:
                    content = import_stmt + content
            else:
                content = import_stmt + content
                
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

modified_count = 0
for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.ts') or file.endswith('.tsx'):
            if process_file(os.path.join(root, file)):
                modified_count += 1

print(f"Modified {modified_count} files.")

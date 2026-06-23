import os
import re
import difflib

files_changed = {}

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace '/auth/', `/auth/`, and "/auth/" with /api/auth/
            new_content = re.sub(r"'/auth/", "'/api/auth/", content)
            new_content = re.sub(r"`/auth/", "`/api/auth/", new_content)
            new_content = re.sub(r'"/auth/', '"/api/auth/', new_content)
            
            if new_content != content:
                diff = list(difflib.unified_diff(
                    content.splitlines(),
                    new_content.splitlines(),
                    fromfile=path,
                    tofile=path,
                    lineterm=''
                ))
                files_changed[path] = diff
                
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)

for path, diff in files_changed.items():
    print(f"=== File: {path} ===")
    for line in diff:
        if line.startswith('-') and not line.startswith('---'):
            print(line)
        elif line.startswith('+') and not line.startswith('+++'):
            print(line)
    print("")

print("Done replacing auth routes.")

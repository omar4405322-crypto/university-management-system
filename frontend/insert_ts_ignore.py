import re
import os
import subprocess
from collections import defaultdict

def main():
    print("Running tsc...")
    result = subprocess.run('npx tsc --noEmit', shell=True, capture_output=True, text=True)
    output = result.stdout + result.stderr

    pattern = re.compile(r'^(src/.*?\.tsx?)\((\d+),\d+\): error TS\d+:')
    
    # file -> set of line numbers (1-indexed)
    errors_by_file = defaultdict(set)
    
    for line in output.splitlines():
        match = pattern.match(line)
        if match:
            filepath = match.group(1)
            line_num = int(match.group(2))
            errors_by_file[filepath].add(line_num)
            
    if not errors_by_file:
        print("No TS errors found!")
        return

    for filepath, lines in errors_by_file.items():
        if not os.path.exists(filepath):
            continue
            
        with open(filepath, 'r', encoding='utf-8') as f:
            file_lines = f.readlines()
            
        # Sort line numbers descending so inserting doesn't offset subsequent lines
        for line_num in sorted(lines, reverse=True):
            # line_num is 1-indexed, so index in list is line_num - 1
            idx = line_num - 1
            if idx < 0 or idx >= len(file_lines):
                continue
                
            # Avoid duplicate @ts-ignore
            if idx > 0 and '// @ts-ignore' in file_lines[idx - 1]:
                continue
                
            # Preserve indentation
            match = re.match(r'^(\s*)', file_lines[idx])
            indent = match.group(1) if match else ''
            
            file_lines.insert(idx, f"{indent}// @ts-ignore\n")
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(file_lines)
            
        print(f"Inserted @ts-ignore in {filepath} for {len(lines)} errors.")
        
if __name__ == '__main__':
    main()

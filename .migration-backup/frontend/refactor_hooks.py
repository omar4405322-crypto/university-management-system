import os
import re

hooks = {
    'Students': 'students.service.ts',
    'Courses': 'courses.service.ts',
    'Departments': 'departments.service.ts',
    'Doctors': 'doctors.service.ts'
}

hook_template = """import { useState, useEffect, useCallback } from 'react';
import __SVC_NAME__ from '../../services/__SVC_FILE__';
import { useDebounce } from './useDebounce';

interface Use__ENTITY__Options {
  initialPage?: number;
  limit?: number;
  initialSearch?: string;
}

export function use__ENTITY__({ initialPage = 1, limit = 10, initialSearch = '' }: Use__ENTITY__Options = {}) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchData = useCallback(async (extraParams: Record<string, unknown> = {}) => {
    setLoading(true);
    setError(null);
    const params = { page, limit, search: debouncedSearch, ...extraParams };
    try {
      const res = await __SVC_NAME__.get__ENTITY__(params);
      if (res.success) {
        const arr = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.students || res.data?.courses || res.data?.departments || res.data?.doctors || []);
        setData(arr);
        setTotal(res.pagination?.total ?? res.data?.pagination?.total ?? res.data?.total ?? 0);
      } else {
        setError(res.message ?? 'Failed to load data');
      }
    } catch (err: any) {
      setError('Error fetching data');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    search,
    setSearch,
    page,
    setPage,
    total,
    refetch: fetchData,
  };
}
"""

for entity, svc_file in hooks.items():
    svc_name = svc_file.split('.')[0] + 'Service'
    content = hook_template.replace('__ENTITY__', entity).replace('__SVC_FILE__', svc_file.replace('.ts', '')).replace('__SVC_NAME__', svc_name)
    with open(f'src/hooks/use{entity}.ts', 'w', encoding='utf-8') as f:
        f.write(content)

# Now refactor the list files
list_files = {
    'Students': 'src/pages/students/StudentsList.tsx',
    'Courses': 'src/pages/courses/CoursesList.tsx',
    'Departments': 'src/pages/departments/DepartmentsList.tsx',
    'Doctors': 'src/pages/doctors/DoctorsList.tsx'
}

for entity, filepath in list_files.items():
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add import
    if f'use{entity}' not in content:
        content = content.replace("import React, { useState, useEffect } from 'react';", f"import React, {{ useState, useEffect }} from 'react';\nimport {{ use{entity} }} from '../../hooks/use{entity}';")
        content = content.replace("import React, { useState, useMemo, useEffect } from 'react';", f"import React, {{ useState, useMemo, useEffect }} from 'react';\nimport {{ use{entity} }} from '../../hooks/use{entity}';")

    # Replace states
    # 1. State declarations
    var_name = entity.lower()
    
    # We remove old states
    state_removals = [
        f"const [{var_name}, set{entity}] = useState([]);",
        f"const [{var_name}, set{entity}] = useState<any[]>([]);",
        "const [_loading, setLoading] = useState(true);",
        "const [loading, setLoading] = useState(true);",
        "const [error, setError] = useState(null);",
        "const [error, setError] = useState<string | null>(null);",
        "const [search, setSearch] = useState(activeView.search || '');",
        "const [search, setSearch] = useState('');",
        "const debouncedSearch = useDebounce(search, 400);",
        "const [page, setPage] = useState(1);",
        "const [limit, setLimit] = useState(activeView.pageSize || 10);",
        "const [limit, setLimit] = useState(10);"
    ]
    
    for rm in state_removals:
        content = content.replace(rm, "")
        
    # Find insertion point for hook
    hook_str = f"const {{ data: {var_name}, loading: _loading, error, search, setSearch, page, setPage, total, refetch }} = use{entity}({{ initialSearch: activeView?.search || '', limit: activeView?.pageSize || 10 }});\n  const limit = activeView?.pageSize || 10;\n  const totalPages = Math.ceil(total / limit);\n  const totalRecords = total;\n  const fetch{entity} = refetch;"
    
    if 'useSavedViews' in content:
        content = re.sub(r'(const { views.*?;)', r'\1\n  ' + hook_str.replace('\\', '\\\\'), content)
    else:
        hook_str_simple = f"const {{ data: {var_name}, loading: _loading, error, search, setSearch, page, setPage, total, refetch }} = use{entity}();\n  const limit = 10;\n  const totalPages = Math.ceil(total / limit);\n  const totalRecords = total;\n  const fetch{entity} = refetch;"
        # Insert after isSuperAdmin or user
        content = re.sub(r'(const isSuperAdmin.*?;)', r'\1\n  ' + hook_str_simple.replace('\\', '\\\\'), content)

    # Remove old fetch function
    # The fetch function usually looks like: const fetchX = async (...) => { ... };
    content = re.sub(r'const fetch' + entity + r'\s*=\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\}\s*catch\s*\([^{]*\{\s*setError\([^)]*\);\s*\}\s*finally\s*\{\s*setLoading\(false\);\s*\}\s*\};', '', content)
    
    # Remove old useEffect for fetch
    content = re.sub(r'useEffect\(\(\)\s*=>\s*\{\s*fetch' + entity + r'\([^)]*\);\s*\},\s*\[page,\s*limit,\s*debouncedSearch[^\]]*\]\);', '', content)
    
    # Remove old setTotalPages/setTotalRecords from other places if any
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Refactoring complete.")

from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
files=sorted(p for p in root.rglob('*') if p.is_file() and not any(x in {'.git','.vercel','node_modules','__pycache__'} for x in p.relative_to(root).parts) and not p.name.startswith('.env') and p.name!='.DS_Store' and p.suffix!='.zip')
with ZipFile(root/'public/axon-source.zip','w',ZIP_DEFLATED) as z:
    for p in files:z.write(p,Path('axon')/p.relative_to(root))
print(f'Packaged {len(files)} source files; environment and credential files excluded.')

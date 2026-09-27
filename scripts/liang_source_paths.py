"""Locate locally supplied Liang sources; an explicit directory always wins."""
from pathlib import Path


def find_source(pattern, source_dir=None):
    directories = ([Path(source_dir).expanduser()] if source_dir is not None else
                   [Path.home() / 'Downloads' / '年表资料', Path.home() / 'Downloads'])
    for directory in directories:
        matches = sorted(directory.glob(pattern))
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            raise ValueError(f'{directory.name}: expected one {pattern}, found {len(matches)}; specify a directory containing the intended edition')
    raise FileNotFoundError(f'Missing {pattern}; searched: ' + ', '.join(str(p) for p in directories))

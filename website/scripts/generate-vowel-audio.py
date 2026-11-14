"""One-time asset generation: pip install edge-tts==7.3.1, then run this script.
Only the five fixed public vowel characters are sent to the speech service.
The website plays the resulting bundled MP3s without a speech-service request.
"""
import asyncio
from pathlib import Path
import edge_tts

async def main():
    destination = Path(__file__).resolve().parents[1] / 'public/audio/ne'
    destination.mkdir(parents=True, exist_ok=True)
    for name, letter in [('a', 'अ'), ('aa', 'आ'), ('i', 'इ'), ('ii', 'ई'), ('u', 'उ')]:
        path = destination / f'{name}.mp3'
        await asyncio.wait_for(edge_tts.Communicate(letter, 'ne-NP-HemkalaNeural', rate='-15%').save(str(path)), timeout=25)
        if path.stat().st_size < 1000:
            raise RuntimeError(f'Empty pronunciation clip: {name}')
        print(f'{letter}: {path.name}, {path.stat().st_size} bytes', flush=True)

asyncio.run(main())

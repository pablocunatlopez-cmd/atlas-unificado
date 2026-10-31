from __future__ import annotations

import argparse

from .game_generator import AtlasGameGenerator


def main():
    parser = argparse.ArgumentParser(description="Genera un prototipo original de juego urbano")
    parser.add_argument("prompt", nargs="*", help="Prompt de diseño del juego")
    parser.add_argument("--root", default=".", help="Directorio del proyecto")
    args = parser.parse_args()

    prompt = " ".join(args.prompt) if args.prompt else "Juego urbano original, barrio, coches, misión principal, estilo moderno"
    generator = AtlasGameGenerator(project_root=args.root)
    print(generator.generate_project(prompt))


if __name__ == "__main__":
    main()

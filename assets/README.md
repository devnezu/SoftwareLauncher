# Assets

Ícones e recursos visuais da aplicação.

## Ícones Necessários para Build

### Windows
- `icon.ico` - 256x256 ou maior

### Linux
- `icon.png` - 512x512 recomendado

### macOS
- `icon.icns` - Formato ICNS padrão

## Criar Ícones

### Online
- [CloudConvert](https://cloudconvert.com/)
- [iConvert Icons](https://iconverticons.com/)

### Desktop
- **Windows**: [IcoFX](https://icofx.ro/)
- **macOS**: [Image2Icon](https://img2icnsapp.com/)
- **Linux**: ImageMagick

### ImageMagick (Linux/Mac)

```bash
# ICO
convert icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico

# ICNS (macOS)
mkdir icon.iconset
sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32 icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64 icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256 icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png
cp icon.png icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
```

## Especificações

- **Tamanho base**: 1024x1024 pixels
- **Formato**: PNG com transparência
- **Design**: Simples e reconhecível em tamanhos pequenos
- **Dica**: Use play button (▶) para representar "launcher"

---

**Nota**: Durante desenvolvimento, o Electron usa ícone padrão. Build requer ícones customizados.

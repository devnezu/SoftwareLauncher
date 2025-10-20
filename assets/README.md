# Assets

Esta pasta contém os ícones e recursos visuais da aplicação.

## Ícones Necessários

Para fazer o build da aplicação, você precisará adicionar os seguintes ícones nesta pasta:

### Windows
- `icon.ico` - Ícone no formato ICO (256x256 ou maior)

### Linux
- `icon.png` - Ícone no formato PNG (512x512 recomendado)

### macOS
- `icon.icns` - Ícone no formato ICNS

## Como Criar os Ícones

Você pode usar ferramentas online ou locais para converter uma imagem PNG em diferentes formatos:

### Ferramentas Online
- [CloudConvert](https://cloudconvert.com/) - Converte para ICO e ICNS
- [iConvert Icons](https://iconverticons.com/) - Especializado em ícones

### Ferramentas Desktop
- **Windows**: [IcoFX](https://icofx.ro/)
- **macOS**: [Image2Icon](https://img2icnsapp.com/)
- **Linux**: ImageMagick

### Usando ImageMagick (Linux/Mac)

```bash
# Criar ICO
convert icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico

# Criar ICNS (macOS)
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

## Design Recomendado

Para melhores resultados, crie um ícone:

- **Tamanho**: 1024x1024 pixels
- **Formato**: PNG com transparência
- **Design**: Simples e reconhecível em tamanhos pequenos
- **Cores**: Use as cores do tema da aplicação (#6366f1 - roxo/azul)

### Sugestão de Design

Um play button (▶) estilizado pode representar bem a função "launcher" da aplicação.

## Nota

Enquanto os ícones não forem adicionados, a aplicação usará o ícone padrão do Electron durante o desenvolvimento. O build só funcionará completamente quando os ícones estiverem presentes.

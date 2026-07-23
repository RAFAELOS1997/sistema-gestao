# Como usar o Antigravity pra editar o sistema

O Antigravity CLI (ferramenta do Google, substituiu o antigo "Gemini CLI"
em junho de 2026) já está instalado e logado no seu computador. Ele
funciona parecido com o Claude Code — você conversa em português e ele lê/
edita os arquivos do projeto direto.

## Como abrir

1. Abra o **PowerShell**.
2. Digite:
   ```
   cd D:\Downloads\sistema-gestao
   agy
   ```
3. Já abre logado (conta `raffz.pantera@gmail.com`), apontado pra pasta
   certa do projeto.

## Como pedir uma alteração

Escreva o que você quer, do mesmo jeito que pede pra mim. Exemplo:
```
Muda a cor do botão de "Confirmar Entrega" pra verde
```
Revise o que ele propõe antes de aceitar — mais seguro que deixar ele
aplicar tudo sem mostrar antes.

## Importante — evitar conflito comigo (Claude Code)

Como agora são duas IAs diferentes mexendo no mesmo projeto: **não peça a
mesma coisa pros dois ao mesmo tempo**. Se pedir uma coisa pro Antigravity,
deixe ele terminar (e confirme que ele fez `git push`) antes de pedir outra
coisa pra mim sobre o mesmo assunto — e vice-versa. Isso evita o que já
aconteceu uma vez aqui: duas sessões construindo a mesma coisa ao mesmo
tempo e uma ter que jogar o trabalho fora.

Depois que o Antigravity terminar e fizer o `git push`, o deploy sobe
sozinho igual sempre (mesmo repositório, mesma Hostinger).

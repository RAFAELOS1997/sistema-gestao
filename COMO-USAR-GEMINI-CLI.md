# Como usar o Gemini pra editar o sistema (Gemini CLI)

O Gemini CLI já está instalado no seu computador. Ele funciona parecido com
o Claude Code — você conversa em português e ele lê/edita os arquivos do
projeto direto.

## Primeira vez (fazer login)

1. Abra o **PowerShell** (ou o terminal que você usa com o Claude Code).
2. Digite:
   ```
   cd D:\Downloads\sistema-gestao
   gemini
   ```
3. Na primeira vez, ele vai perguntar como você quer fazer login. Escolha
   **"Login with Google"** (é grátis, usa sua conta Google normal) — vai
   abrir o navegador pra você entrar com sua conta.
4. Depois de logado, ele já fica pronto pra conversar ali mesmo no terminal.

## Todas as próximas vezes

Só abrir o terminal e rodar:
```
cd D:\Downloads\sistema-gestao
gemini
```
Ele já lembra do login.

## Como pedir uma alteração

Escreva o que você quer, do mesmo jeito que pede pra mim. Exemplo:
```
Muda a cor do botão de "Confirmar Entrega" pra verde
```
Ele vai mostrar o que pretende mudar antes de mexer nos arquivos (a não ser
que você ligue o "yolo mode", que deixa ele fazer tudo sem perguntar —
**não recomendo** ligar isso, é mais seguro sempre revisar antes de aceitar).

## Importante — evitar conflito comigo (Claude Code)

Como agora são duas IAs diferentes mexendo no mesmo projeto: **não peça a
mesma coisa pros dois ao mesmo tempo**. Se pedir uma coisa pro Gemini,
deixe ele terminar (e confirme que ele fez `git push`) antes de pedir outra
coisa pra mim sobre o mesmo assunto — e vice-versa. Isso evita o que já
aconteceu uma vez aqui: duas sessões construindo a mesma coisa ao mesmo
tempo e uma ter que jogar o trabalho fora.

Depois que o Gemini terminar e fizer o `git push`, o deploy sobe sozinho
igual sempre (mesmo repositório, mesma Hostinger).

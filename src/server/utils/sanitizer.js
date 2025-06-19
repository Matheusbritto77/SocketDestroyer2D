const sanitizeHtml = require('sanitize-html');

class MessageSanitizer {
  constructor() {
    // Configuração de sanitização
    this.sanitizeOptions = {
      allowedTags: [
        'b', 'i', 'em', 'strong', 'u', 'br', 'p', 'span',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre'
      ],
      allowedAttributes: {
        '*': ['class', 'style'],
        'span': ['class', 'style'],
        'p': ['class', 'style'],
        'code': ['class'],
        'pre': ['class']
      },
      allowedStyles: {
        '*': {
          'color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/],
          'text-align': [/^left$/, /^right$/, /^center$/],
          'font-size': [/^\d+(?:px|em|%)$/],
          'font-weight': [/^bold$/, /^normal$/],
          'text-decoration': [/^underline$/, /^line-through$/]
        }
      },
      disallowedTagsMode: 'recursiveEscape'
    };

    // Emojis permitidos
    this.allowedEmojis = new Set([
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
      '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
      '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
      '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
      '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😯', '😦', '😧',
      '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢',
      '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '💩', '👻', '💀',
      '☠️', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽',
      '🙀', '😿', '😾', '🙈', '🙉', '🙊', '👶', '👧', '🧒', '👦',
      '👩', '🧑', '👨', '👵', '🧓', '👴', '👮‍♀️', '👮', '👮‍♂️',
      '🕵️‍♀️', '🕵️', '🕵️‍♂️', '💂‍♀️', '💂', '💂‍♂️', '👷‍♀️',
      '👷', '👷‍♂️', '🤴', '👸', '👳‍♀️', '👳', '👳‍♂️', '👲', '🧕',
      '🤵', '👰', '🤰', '🤱', '👼', '🎅', '🤶', '🧙‍♀️', '🧙',
      '🧙‍♂️', '🧝‍♀️', '🧝', '🧝‍♂️', '🧛‍♀️', '🧛', '🧛‍♂️',
      '🧟‍♀️', '🧟', '🧟‍♂️', '🧞‍♀️', '🧞', '🧞‍♂️', '🧜‍♀️',
      '🧜', '🧜‍♂️', '🧚‍♀️', '🧚', '🧚‍♂️', '👼', '🤰', '🤱',
      '🙇‍♀️', '🙇', '🙇‍♂️', '💁‍♀️', '💁', '💁‍♂️', '🙅‍♀️',
      '🙅', '🙅‍♂️', '🙆‍♀️', '🙆', '🙆‍♂️', '🙋‍♀️', '🙋', '🙋‍♂️',
      '🤦‍♀️', '🤦', '🤦‍♂️', '🤷‍♀️', '🤷', '🤷‍♂️', '👨‍⚕️',
      '👩‍⚕️', '👨‍🎓', '👩‍🎓', '👨‍🏫', '👩‍🏫', '👨‍⚖️', '👩‍⚖️',
      '👨‍🌾', '👩‍🌾', '👨‍🍳', '👩‍🍳', '👨‍🔧', '👩‍🔧', '👨‍🏭',
      '👩‍🏭', '👨‍💼', '👩‍💼', '👨‍🔬', '👩‍🔬', '👨‍💻', '👩‍💻',
      '👨‍🎤', '👩‍🎤', '👨‍🎨', '👩‍🎨', '👨‍✈️', '👩‍✈️', '👨‍🚀',
      '👩‍🚀', '👨‍🚒', '👩‍🚒', '👮‍♀️', '👮', '👮‍♂️', '🕵️‍♀️',
      '🕵️', '🕵️‍♂️', '💂‍♀️', '💂', '💂‍♂️', '👷‍♀️', '👷', '👷‍♂️',
      '🤴', '👸', '👳‍♀️', '👳', '👳‍♂️', '👲', '🧕', '🤵', '👰',
      '🤰', '🤱', '👼', '🎅', '🤶', '🧙‍♀️', '🧙', '🧙‍♂️', '🧝‍♀️',
      '🧝', '🧝‍♂️', '🧛‍♀️', '🧛', '🧛‍♂️', '🧟‍♀️', '🧟', '🧟‍♂️',
      '🧞‍♀️', '🧞', '🧞‍♂️', '🧜‍♀️', '🧜', '🧜‍♂️', '🧚‍♀️', '🧚',
      '🧚‍♂️', '👼', '🤰', '🤱', '🙇‍♀️', '🙇', '🙇‍♂️', '💁‍♀️',
      '💁', '💁‍♂️', '🙅‍♀️', '🙅', '🙅‍♂️', '🙆‍♀️', '🙆', '🙆‍♂️',
      '🙋‍♀️', '🙋', '🙋‍♂️', '🤦‍♀️', '🤦', '🤦‍♂️', '🤷‍♀️', '🤷',
      '🤷‍♂️', '👨‍⚕️', '👩‍⚕️', '👨‍🎓', '👩‍🎓', '👨‍🏫', '👩‍🏫',
      '👨‍⚖️', '👩‍⚖️', '👨‍🌾', '👩‍🌾', '👨‍🍳', '👩‍🍳', '👨‍🔧',
      '👩‍🔧', '👨‍🏭', '👩‍🏭', '👨‍💼', '👩‍💼', '👨‍🔬', '👩‍🔬',
      '👨‍💻', '👩‍💻', '👨‍🎤', '👩‍🎤', '👨‍🎨', '👩‍🎨', '👨‍✈️',
      '👩‍✈️', '👨‍🚀', '👩‍🚀', '👨‍🚒', '👩‍🚒'
    ]);
  }

  // Sanitiza uma mensagem
  sanitizeMessage(content) {
    if (typeof content !== 'string') {
      return '';
    }

    // Remove caracteres de controle perigosos
    let sanitized = content
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim();

    // Verifica se a mensagem está vazia após limpeza
    if (!sanitized) {
      return '';
    }

    // Sanitiza HTML
    sanitized = sanitizeHtml(sanitized, this.sanitizeOptions);

    // Limita o tamanho da mensagem
    if (sanitized.length > 1000) {
      sanitized = sanitized.substring(0, 1000) + '...';
    }

    return sanitized;
  }

  // Valida emojis
  validateEmojis(content) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const emojis = content.match(emojiRegex) || [];
    
    // Remove emojis não permitidos
    const filteredEmojis = emojis.filter(emoji => this.allowedEmojis.has(emoji));
    
    // Substitui emojis não permitidos por texto
    let result = content;
    emojis.forEach(emoji => {
      if (!this.allowedEmojis.has(emoji)) {
        result = result.replace(emoji, `[emoji:${emoji.codePointAt(0).toString(16)}]`);
      }
    });

    return result;
  }

  // Processa uma mensagem completa
  processMessage(content) {
    // Sanitiza primeiro
    let processed = this.sanitizeMessage(content);
    
    // Valida emojis
    processed = this.validateEmojis(processed);
    
    return processed;
  }

  // Verifica se uma mensagem é spam
  isSpam(content, userHistory = []) {
    // Verifica mensagens repetidas
    const recentMessages = userHistory.slice(-5);
    const repeatedCount = recentMessages.filter(msg => 
      msg.content === content
    ).length;

    if (repeatedCount >= 3) {
      return true;
    }

    // Verifica mensagens muito curtas repetidas
    if (content.length < 3) {
      const shortMessages = recentMessages.filter(msg => 
        msg.content.length < 3
      ).length;
      
      if (shortMessages >= 5) {
        return true;
      }
    }

    // Verifica links suspeitos
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = content.match(urlRegex) || [];
    
    if (urls.length > 2) {
      return true;
    }

    return false;
  }

  // Adiciona emoji à lista permitida
  addAllowedEmoji(emoji) {
    this.allowedEmojis.add(emoji);
  }

  // Remove emoji da lista permitida
  removeAllowedEmoji(emoji) {
    this.allowedEmojis.delete(emoji);
  }

  // Obtém lista de emojis permitidos
  getAllowedEmojis() {
    return Array.from(this.allowedEmojis);
  }
}

module.exports = new MessageSanitizer(); 
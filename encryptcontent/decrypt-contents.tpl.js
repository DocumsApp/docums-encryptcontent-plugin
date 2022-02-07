/* encryptcontent/decryp-contents.tpl.js */

/* Strips the padding character from decrypted content. */
function strip_padding(padded_content, padding_char) {
    for (var i = padded_content.length; i > 0; i--) {
        if (padded_content[i - 1] !== padding_char) {
            return padded_content.slice(0, i);
        }
    }
};

/* Decrypts the content from the ciphertext bundle. */
function decrypt_content(password, iv_b64, ciphertext_b64, padding_char) {   
    var key = CryptoJS.MD5(password),
        iv = CryptoJS.enc.Base64.parse(iv_b64),
        ciphertext = CryptoJS.enc.Base64.parse(ciphertext_b64),
        bundle = {
            key: key,
            iv: iv,
            ciphertext: ciphertext
        };
    var plaintext = CryptoJS.AES.decrypt(bundle, key, {
        iv: iv,
        padding: CryptoJS.pad.NoPadding
    });
    try {
        return strip_padding(plaintext.toString(CryptoJS.enc.Utf8), padding_char);
    } catch (err) {
        // encoding failed; wrong password
        return false;
    }
};

{% if remember_password -%}
/* Set key:value with expire time in localStorage */
function setItemExpiry(key, value, ttl) {
    const now = new Date()
    const item = {
        value: encodeURIComponent(value),
        expiry: now.getTime() + ttl,
    }
    localStorage.setItem('encryptcontent_' + encodeURIComponent(key), JSON.stringify(item))
};

/* Delete key with specific name in localStorage */
function delItemName(key) {
    localStorage.removeItem('encryptcontent_' + encodeURIComponent(key));
};

/* Get key:value from localStorage */
function getItemExpiry(key) {
    var remember_password = localStorage.getItem('encryptcontent_' + encodeURIComponent(key));
    if (!remember_password) {
        // fallback to search default password defined by path
        var remember_password = localStorage.getItem('encryptcontent_' + encodeURIComponent("/"));
        if (!remember_password) {
            return null
        }
    }
    const item = JSON.parse(remember_password)
    const now = new Date()
    if (now.getTime() > item.expiry) {
        // if the item is expired, delete the item from storage and return null
        localStorage.removeItem('encryptcontent_' + encodeURIComponent(key))
        return null
    }
    return decodeURIComponent(item.value)
};
{%- endif %}

/* Reload scripts src after decryption process */
function reload_js(src) {
    $('script[src="' + src + '"]').remove();
    $('<script>').attr('src', src).appendTo('head');
};

/* Decrypt part of the search index and refresh it for search engine */
function decrypt_search(password_input, path_location) {
    sessionIndex = sessionStorage.getItem('encryptcontent-index');
    if (sessionIndex) {
        sessionIndex = JSON.parse(sessionIndex);
        for (var i=0; i < sessionIndex.docs.length; i++) {
            var doc = sessionIndex.docs[i];
            if (doc.location.indexOf(path_location) !== -1) {
                // grab the ciphertext bundle and try to decrypt it
                var parts = doc.text.split(';');
                if (parts[0], parts[1], parts[2]) {
                    var content = decrypt_content(password_input.value, parts[0], parts[1], parts[2]);
                };
                if (content) {
                    doc.text = content;
                    // any post processing on the decrypted search index should be done here
                };
            }
        };
        // force search index reloading on Worker
        if (!window.Worker) {
            console.log('Web Worker API not supported');
        } else {
            sessionIndex = JSON.stringify(sessionIndex);
            sessionStorage.setItem('encryptcontent-index', sessionIndex);
            searchWorker.postMessage({init: true, sessionIndex: sessionIndex});
        };
    }
};

/* Decrypt speficique html entry from docums configuration */
function decrypt_somethings(password_input, encrypted_something) {
    var html_item = '';
    for (const [name, tag] of Object.entries(encrypted_something)) {
        if (tag[1] == 'id') {
            html_item = [document.getElementById(name)];
        } else if (tag[1] == 'class') {
            html_item = document.getElementsByClassName(name);
        } else {
            console.log('WARNING: Unknow tag html found, check "encrypted_something" configuration.');
        }
        if (html_item) {
            for (i = 0; i < html_item.length; i++) {
                // grab the cipher bundle if something exist
                if (html_item[i]) {
                    var parts = html_item[i].innerHTML.split(';');
                    // decrypt it
                    if (parts[0], parts[1], parts[2]) {
                        var content = decrypt_content(password_input.value, parts[0], parts[1], parts[2]);
                    };
                    if (content) {
                        // success; display the decrypted content
                        html_item[i].innerHTML = content;
                        html_item[i].style.display = null;
                        // any post processing on the decrypted content should be done here
                    };
                }
            }
        }
    }
};

/* Decrypt content a page */
function decrypt_action(password_input, encrypted_content, decrypted_content) {
    // grab the ciphertext bundle
    var parts = encrypted_content.innerHTML.split(';');
    // decrypt it
    var content = decrypt_content(
        password_input.value, parts[0], parts[1], parts[2]
    );
    if (content) {
        // success; display the decrypted content
        decrypted_content.innerHTML = content;
        // encrypted_content.parentNode.removeChild(encrypted_content);
        // any post processing on the decrypted content should be done here
        {% if arithmatex -%}
        if (typeof MathJax === 'object') { MathJax.typesetPromise(); };
        {%- endif %}
        {% if hljs -%}
        document.getElementById("docums-decrypted-content").querySelectorAll('pre code').forEach((block) => {
            hljs.highlightBlock(block);
        });
        {%- endif %}
        {% if reload_scripts | length > 0 -%}
        let reload_scripts = {{ reload_scripts }};
        for (i = 0; i < reload_scripts.length; i++) { 
            reload_js(reload_scripts[i]);
        }
        {%- endif %}
        return true
    } else {
        // create HTML element for the inform message
        var decrypt_msg = document.createElement('p');
        decrypt_msg.setAttribute('id', 'docums-decrypt-msg');
        var node = document.createTextNode('{{ decryption_failure_message }}');
        decrypt_msg.appendChild(node);
        var docums_decrypt_msg = document.getElementById('docums-decrypt-msg');
        // clear all previous failure messages
        while (docums_decrypt_msg.firstChild) {
            docums_decrypt_msg.firstChild.remove();
        }
        docums_decrypt_msg.appendChild(decrypt_msg);
        password_input.value = '';
        password_input.focus();
        return false
    }
};

/* Trigger decryption process */
function init_decryptor() {
    var password_input = document.getElementById('docums-content-password'),
        encrypted_content = document.getElementById('docums-encrypted-content'),
        decrypted_content = document.getElementById('docums-decrypted-content'),
        {% if password_button -%}
        decrypt_button = document.getElementById("docums-decrypt-button"),
        {%- endif %}
        decrypt_form = document.getElementById('docums-decrypt-form');
    // adjust password field width to placeholder length
    let input = document.getElementById("docums-content-password");
    input.setAttribute('size', input.getAttribute('placeholder').length);
    {% if encrypted_something -%}
    var encrypted_something = {{ encrypted_something }};
    {%- endif %}

    {% if remember_password -%}
    /* If remember_password is set, try to use localstorage item to decrypt content when page is loaded */
    var password_cookie = getItemExpiry(window.location.pathname);
    if (password_cookie) {
        password_input.value = password_cookie;
        var content_decrypted = decrypt_action(
            password_input, encrypted_content, decrypted_content
        );
        if (content_decrypted) {
            // continue to decrypt others parts
            {% if experimental -%}
            var search_decrypted = decrypt_search(password_input, window.location.pathname.substring(1));
            {%- endif %}
            {% if encrypted_something -%}
            var something_decrypted = decrypt_somethings(password_input, encrypted_something);
            {%- endif %}
        } else {
            // remove item on localStorage if decryption process fail (Invalid item)
            delItemName(window.location.pathname)
        }
    };
    {%- endif %}

    {% if password_button -%}
    /* If password_button is set, try decrypt content when button is press */
    if (decrypt_button) {
        decrypt_button.onclick = function(event) {
            event.preventDefault();
            var content_decrypted = decrypt_action(
                password_input, encrypted_content, decrypted_content
            );
            if (content_decrypted) {
                {% if remember_password -%}
                // keep password value on localStorage with specific path (relative)
                setItemExpiry(document.location.pathname, password_input.value, 1000*3600*{{ default_expire_dalay | int }});
                {%- endif %}
                // continue to decrypt others parts
                {% if experimental -%}
                var search_decrypted = decrypt_search(password_input, window.location.pathname.substring(1));
                {%- endif %}
                {% if encrypted_something -%}
                var something_decrypted = decrypt_somethings(password_input, encrypted_something);
                {%- endif %}
            } else {
                // TODO ?
            };
        };
    }
    {%- endif %}

    /* Default, try decrypt content when key (ctrl) enter is press */
    password_input.addEventListener('keypress', function(event) {
        if (event.key === "Enter") {
            var location_path = document.location.pathname;
            var is_global = false;
            if (event.ctrlKey) { 
                var location_path = "/";
                var is_global = true;
            };
            event.preventDefault();
            var content_decrypted = decrypt_action(
                password_input, encrypted_content, decrypted_content
            );
            if (content_decrypted) {
                {% if remember_password -%}
                // keep password value on localStorage with specific path (relative)
                setItemExpiry(location_path, password_input.value, 1000*3600*{{ default_expire_dalay | int }});
                {%- endif %}
                // continue to decrypt others parts
                {% if experimental -%}
                if (is_global) {
                    var search_decrypted = decrypt_search(password_input, location_path);
                } else {
                    var search_decrypted = decrypt_search(password_input, location_path.substring(1));
                };
                {%- endif %}
                {% if encrypted_something -%}
                var something_decrypted = decrypt_somethings(password_input, encrypted_something);
                {%- endif %}
            } else {
                // TODO ?
            };
        }
    });
};

document.addEventListener('DOMContentLoaded', init_decryptor());

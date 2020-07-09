import { Inject, Injectable, Optional } from '@angular/core';
import { guid } from '@firestitch/common';

import { FS_TRANSFER_HANDLER } from '../fs-transfer-providers';
import { FsTransferHandler } from '../handlers/transfer.handler';
import { Request } from '../models/request.model';
import { format } from 'date-fns';


@Injectable()
export class FsTransferService {

  constructor(
    // Custom interceptors
    @Optional() @Inject(FS_TRANSFER_HANDLER) private handler: FsTransferHandler,
  ) {
  }

  public post(path, parameters = {}) {
    return this.request(path, 'post', parameters);
  }

  public request(path, method = 'get', parameters = {}) {
    const request = new Request(method, path, parameters);

    this._cleanup();
    this.handler.begin(request);
    const uuid = guid();

    const container = this.initContainer();
    const iframe = this.initFrame(uuid);
    const form = this.initForm(path, method, parameters, uuid);

    const div = document.createElement('div');

    div.setAttribute('id', `fs-transfer-${uuid}`);
    div.setAttribute('data-time', (new Date()).getTime().toString());
    div.classList.add('fs-transfer');
    div.appendChild(form);
    div.appendChild(iframe);
    div.setAttribute('style', 'display: none;');

    container.appendChild(div);

    form.submit();
    iframe.setAttribute('submitted', 'true');
  }

  private initContainer() {
    let container = document.getElementById('fs-transfer-container');

    if (!container) {
      container = document.createElement('div');
      container.setAttribute('id', 'fs-transfer-container');
      document.body.appendChild(container);
    }

    return container;
  }

  private initFrame(uniqID) {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', 'about:blank');
    iframe.setAttribute('name', `fs-transfer-iframe-${uniqID}`);
    iframe.setAttribute('id', `fs-transfer-iframe-${uniqID}`);

    iframe.onload = (event: any) => {

      if (!event.target.hasAttribute('submitted')) {
        return;
      }

      let data: any = {};
      let raw = '';

      try {

        // Needs to be the same domain to see the body content
        const iframeBody = iframe.contentWindow.document.body;
        raw = iframeBody.innerText;

        data = JSON.parse(raw);

      } catch (e) { }

      this.handler.error(data, raw);
    };

    return iframe;
  }

  private initForm(path, method, parameters, uniqID) {
    const form = document.createElement('form');
    form.setAttribute('action', path);
    form.setAttribute('method', method);
    form.setAttribute('target', `fs-transfer-iframe-${uniqID}`);

    this._objectToForm(parameters, form);

    return form;
  }

  private _cleanup() {
    // Expiry 1 day
    const expiryTime = (new Date()).getTime() - (60 * 60 * 24);
    document.querySelectorAll('#fs-transfer-container .fs-transfer')
      .forEach((el) => {
        if (parseInt(el.getAttribute('data-time')) < expiryTime) {
          el.remove();
        }
      });
  }

  private _objectToForm(target, form, namespace = null, level = 0) {

    level++;
    // Depth limit
    if (level > 10) {
      throw Error('Maximum call stack size exceeded');
    }

    if (target === void 0 || target === null) {
      return;
    }

    Object.keys(target).forEach((property) => {
      let item = target[property];
      const formKey = namespace ? `${namespace}[${property}]` : property;

      if (item && typeof item === 'object') {
        this._objectToForm(item, form, formKey, level)
      } else {

        if (item instanceof Date) {
          item = format(item, `yyyy-MM-dd'T'HH:mm:ssxxx`);
        }

        const paramInput = document.createElement('input');
        paramInput.setAttribute('type', 'hidden');
        paramInput.setAttribute('name', formKey);
        paramInput.setAttribute('value', item);

        form.appendChild(paramInput);
      }
    });
  }

}

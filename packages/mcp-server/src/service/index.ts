import { BoxService } from './box.service';
import { FileService } from './file.service';

export class Gbox {
    readonly boxes: BoxService;
    readonly files: FileService;
    constructor() {
        this.boxes = new BoxService();
        this.files = new FileService();
    }
}

"""Генерация QR-кода для открытки.

Установка:  pip install "qrcode[pil]"
Запуск:     python tools/make_qr.py https://твой-логин.github.io/gift/
Результат:  qr.png (для экрана) и qr.svg (для печати — вектор, не мылится)
"""
import sys

import qrcode
import qrcode.image.svg
from qrcode.constants import ERROR_CORRECT_Q


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("Укажи ссылку: python tools/make_qr.py https://...")
    url = sys.argv[1]

    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_Q, box_size=20, border=4)
    qr.add_data(url)
    qr.make(fit=True)

    # тёмно-бордовый на белом: читается любым iPhone и красиво смотрится на открытке
    qr.make_image(fill_color="#4a0615", back_color="white").save("qr.png")

    svg = qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage,
                      error_correction=ERROR_CORRECT_Q, border=4)
    svg.save("qr.svg")
    print("Готово: qr.png и qr.svg для", url)


if __name__ == "__main__":
    main()

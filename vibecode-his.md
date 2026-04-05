# 提示词记录

## 2026-04-03

把按钮放到「/html/body/div[1]/div/div/div/div/div/div/div[1]/div/div/div/div[4]/div[1]/div[2]/div[2]/div[1]/div[2]/div/div[3]」的上面

在每个广告的如下位置的，上方并排增加三个按钮 “#mount_0_0_Lb > div > div > div > div > div > div > div.x12peec7.x1dr59a3.x1kgmq87.x1ja2u2z > div > div > div > div.x8bgqxi.x1n2onr6 > div:nth-child(1) > div:nth-child(2) > div.xdj266r.x11t971q.xat24cr.xvc5jky.x1dr75xp.xh8yej3.xkopdvs > div.xrvj5dj.x18m771g.x1p5oq8j.xp48ta0.x18d9i69.xtssl2i.xtqikln.x1na6gtj.xjewof7.x1l48g3s.x1vql8b3.x1m5622i > div:nth-child(4) > div > hr”

//*[@id="mount_0_0_F4"]/div/div/div/div/div/div/div[1]/div/div/div/div[4]/div[1]/div[2]/div[2]/div[1]/div[3]

xpath应该怎么使用和获取

获取「/html/body/div[1]/div/div/div/div/div/div/div[1]/div/div/div/div[5]/div[1]/div[2]/div[2]/div[1]」下所有的广告，然后在每个广告中增加三个按钮

增加一些日志输出，方便跟进定位问题

能否通过文本找到对应的位置。「See summary details」或者 「See ad details」，然后在文本所在的div的并列位置增加div展示所需的按钮和逻辑

找到元素 「<hr class="xjbqb8w xso031l x1q0q8m5 xqtp20y xb9moi8 xe76qn7 x21b0me x142aazg xw7yly9 x1ys307a x1yztbdb xyqm7xq">」, 可以通过class选择器进行选择，然后在他的上面增加按钮，且css样式可以和这个保持一致

以上为增加按钮区域的部分html内容，现在需要调整添加按钮的ui，需要和 See ad details的样式相近。风格一致

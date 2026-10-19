import unittest
import cv2
import numpy as np
import symbols


class SymbolTests(unittest.TestCase):
    def test_calibrated_ryzingsol_layout_reads_simultaneous_buttons(self):
        hsv=np.zeros((864,1536,3),dtype=np.uint8)
        hsv[:,:,2]=15
        for anchor,active in [((500,725),{2}),((700,725),{1,2}),((900,725),{3})]:
            for button,(dx,dy) in symbols.OFFSETS.items():
                color={1:(160,200,230),2:(81,170,230),3:(105,100,210),4:(5,200,230)}[button] if button in active else (0,0,95)
                cv2.circle(hsv,(anchor[0]+dx,anchor[1]+dy),4,color,-1)
        groups=symbols.pads(cv2.cvtColor(hsv,cv2.COLOR_HSV2BGR))
        self.assertEqual([g['buttons'] for g in groups],[[2],[1,2],[3]])

    def test_thefury_uses_its_own_top_overlay_and_button_colors(self):
        hsv=np.zeros((864,1536,3),dtype=np.uint8)
        hsv[:]=(15,200,80)
        for anchor,active in [((245,97),{1}),((430,97),{2}),((650,97),{4})]:
            for button,(dx,dy) in {1:(0,0),2:(13,0),3:(0,13),4:(13,13)}.items():
                color={1:(89,200,220),2:(30,200,240),3:(60,210,240),4:(5,200,220)}[button] if button in active else (100,70,80)
                cv2.circle(hsv,(anchor[0]+dx,anchor[1]+dy),4,color,-1)
        groups=symbols.pads(cv2.cvtColor(hsv,cv2.COLOR_HSV2BGR),'TheFURY')
        self.assertEqual([g['buttons'] for g in groups],[[1],[2],[4]])

if __name__=='__main__':unittest.main()

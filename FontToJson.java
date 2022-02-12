import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.font.*;
import java.awt.geom.*;
import java.awt.image.*;
import java.io.*;
import java.util.*;
public class FontToJson {
    public static void writeJson(int[][] data, int fontHeight, String filename) throws IOException {
        FileWriter fw = new FileWriter(filename);
        fw.write("{\"height\": "+fontHeight+",\n\"font\":"+Arrays.deepToString(data)+"}");
        fw.close();
    }
    public static int[] letterData(String letter, Font font) {
        BufferedImage img = new BufferedImage(1, 1, BufferedImage.TYPE_4BYTE_ABGR);
        Graphics g = img.getGraphics();

        //Set the font to be used when drawing the string
        g.setFont(font);

        //Get the string visual bounds
        FontRenderContext frc = g.getFontMetrics().getFontRenderContext();
        Rectangle2D rect = font.getStringBounds(letter, frc);
        //Release resources
        g.dispose();

        //Then, we have to draw the string on the final image

        //Create a new image where to print the character
        img = new BufferedImage((int) Math.ceil(rect.getWidth()), (int) Math.ceil(rect.getHeight()), BufferedImage.TYPE_4BYTE_ABGR);
        g = img.getGraphics();
        g.setColor(Color.black); //Otherwise the text would be white
        g.setFont(font);

        //Calculate x and y for that string
        FontMetrics fm = g.getFontMetrics();
        int x = 0;
        int y = fm.getAscent(); //getAscent() = baseline
        g.drawString(letter, x, y);

        //Release resources
        g.dispose();
        int[] data = new int[img.getHeight()*img.getWidth()];
        for(int i = 0; i < img.getHeight(); i++) {
            for(int j = 0; j < img.getWidth(); j++) {
                data[i*img.getWidth()+j] = ((img.getRGB(j, i)&0xff000000)>>24)^0xff;
            }
        }
        return data;
    }
    public static int fontHeight(Font font) {
        BufferedImage img = new BufferedImage(1, 1, BufferedImage.TYPE_4BYTE_ABGR);
        Graphics g = img.getGraphics();

        //Set the font to be used when drawing the string
        g.setFont(font);

        //Get the string visual bounds
        FontRenderContext frc = g.getFontMetrics().getFontRenderContext();
        Rectangle2D rect = font.getStringBounds(" ", frc);
        //Release resources
        g.dispose();

        //Then, we have to draw the string on the final image

        //Create a new image where to print the character
        return (int) Math.ceil(rect.getHeight());
    }
    public static void main(String[] args) throws IOException {
        int[][] font = new int[127-32][];
        final Font fontf = new Font("San Francisco", Font.PLAIN, 30);
        for(int i = 32; i <= 126; i++) {
            font[i-32] = letterData(Character.toString((char)i), fontf);
        }
        System.out.println(font.length);
        writeJson(font, fontHeight(fontf), "sanfrancisco30.json");
//        BufferedImage test = new BufferedImage(48, 83, BufferedImage.TYPE_4BYTE_ABGR);
//        int[] s = letterData(Character.toString('S'), new Font("Arial", Font.PLAIN, 72));
//        for(int i = 0; i < 83; i++) {
//            for(int j = 0; j < 48; j++) {
//                test.setRGB(j, i, s[i*48+j] == 0 ? 0 : 0xFFFFFFFF);
//            }
//        }
//        ImageIO.write(test, "png", new File("test.png"));
    }
    public static int[] letterDataRaw(String letter, Font font) {
        BufferedImage img = new BufferedImage(1, 1, BufferedImage.TYPE_4BYTE_ABGR);
        Graphics g = img.getGraphics();

        //Set the font to be used when drawing the string
        g.setFont(font);

        //Get the string visual bounds
        FontRenderContext frc = g.getFontMetrics().getFontRenderContext();
        Rectangle2D rect = font.getStringBounds(letter, frc);
        //Release resources
        g.dispose();

        //Then, we have to draw the string on the final image

        //Create a new image where to print the character
        img = new BufferedImage((int) Math.ceil(rect.getWidth()), (int) Math.ceil(rect.getHeight()), BufferedImage.TYPE_4BYTE_ABGR);
        g = img.getGraphics();
        g.setColor(Color.black); //Otherwise the text would be white
        g.setFont(font);

        //Calculate x and y for that string
        FontMetrics fm = g.getFontMetrics();
        int x = 0;
        int y = fm.getAscent(); //getAscent() = baseline
        g.drawString(letter, x, y);

        //Release resources
        g.dispose();
        int[] data = new int[img.getHeight()*img.getWidth()];
        for(int i = 0; i < img.getHeight(); i++) {
            for(int j = 0; j < img.getWidth(); j++) {
                data[i*img.getWidth()+j] = img.getRGB(j, i);
            }
        }
        System.out.println(letter + ": ("+img.getWidth()+", "+img.getHeight()+")");
        return data;
    }
}
